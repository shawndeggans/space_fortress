// ============================================================================
// SPACE FORTRESS - Ability Effects Processor
// ============================================================================
//
// Automation Pattern: Events trigger ability processing which generates
// new events for ability effects.
//
// See: docs/design/slices/SLICE-09-ABILITY-EFFECTS.md
// ============================================================================

import type {
  TacticalBattleState,
  ShipState,
  CardAbility,
  AbilityEffect,
  AbilityTrigger,
  StatusEffectType
} from './types'
import type { GameEvent } from './events'

function timestamp(): string {
  return new Date().toISOString()
}

// ----------------------------------------------------------------------------
// Trigger Context Types
// ----------------------------------------------------------------------------

export interface TriggerContext {
  trigger: AbilityTrigger
  sourceShipId: string
  sourcePlayer: 'player' | 'opponent'
  targetShipId?: string
  targetPlayer?: 'player' | 'opponent'
}

// ----------------------------------------------------------------------------
// Main Ability Processor
// ----------------------------------------------------------------------------

/**
 * Process abilities for a given trigger and generate effect events.
 * Called from command handlers in decider.ts after trigger events.
 */
export function processAbilities(
  battle: TacticalBattleState,
  context: TriggerContext
): GameEvent[] {
  const events: GameEvent[] = []
  const ts = timestamp()

  // Find the source ship
  const sourceShip = findShip(battle, context.sourceShipId, context.sourcePlayer)
  if (!sourceShip) return events

  // Get abilities that match this trigger
  const abilities = sourceShip.card.abilities?.filter(
    ability => ability.trigger === context.trigger
  ) ?? []

  for (const ability of abilities) {
    // Check cooldown for activated abilities
    if (ability.trigger === 'activated') {
      const cooldown = sourceShip.abilityCooldowns[ability.id] ?? 0
      if (cooldown > 0) continue
    }

    // Generate ABILITY_TRIGGERED event
    events.push({
      type: 'ABILITY_TRIGGERED',
      data: {
        timestamp: ts,
        battleId: battle.battleId,
        cardId: context.sourceShipId,
        abilityId: ability.id,
        trigger: context.trigger as 'onDeploy' | 'onAttack' | 'onDefend' | 'onDestroyed' | 'startTurn' | 'endTurn'
      }
    })

    // Process the ability's effect
    const effectEvents = processEffect(
      battle,
      ability,
      sourceShip,
      context,
      ts
    )
    events.push(...effectEvents)
  }

  return events
}

/**
 * Process a single ability effect and generate events.
 */
function processEffect(
  battle: TacticalBattleState,
  ability: CardAbility,
  sourceShip: ShipState,
  context: TriggerContext,
  ts: string
): GameEvent[] {
  const events: GameEvent[] = []
  const effect = ability.effect

  // Resolve targets based on targetType
  const targets = resolveTargets(battle, ability, sourceShip, context)

  switch (effect.type) {
    // ========================================================================
    // Damage Effects
    // ========================================================================
    case 'deal_damage': {
      for (const target of targets) {
        if (target.type === 'ship') {
          const targetShip = target.ship!
          const damage = effect.amount
          const newHull = Math.max(0, targetShip.currentHull - damage)

          events.push({
            type: 'DAMAGE_DEALT',
            data: {
              timestamp: ts,
              battleId: battle.battleId,
              sourceId: sourceShip.cardId,
              targetId: targetShip.cardId,
              targetPlayer: target.player,
              rawDamage: damage,
              defenseReduction: 0,
              finalDamage: damage,
              targetNewHull: newHull,
              damageType: 'ability'
            }
          })

          if (newHull <= 0) {
            events.push({
              type: 'SHIP_DESTROYED',
              data: {
                timestamp: ts,
                battleId: battle.battleId,
                cardId: targetShip.cardId,
                owner: target.player,
                position: targetShip.position,
                destroyedBy: `ability:${ability.id}`
              }
            })
          }
        }
      }
      break
    }

    case 'area_damage': {
      const areaTargets = effect.targets === 'all_enemies'
        ? getAllEnemyShips(battle, context.sourcePlayer)
        : getAdjacentShips(battle, sourceShip)

      for (const targetShip of areaTargets) {
        const damage = effect.amount
        const newHull = Math.max(0, targetShip.currentHull - damage)
        const targetPlayer = context.sourcePlayer === 'player' ? 'opponent' : 'player'

        events.push({
          type: 'DAMAGE_DEALT',
          data: {
            timestamp: ts,
            battleId: battle.battleId,
            sourceId: sourceShip.cardId,
            targetId: targetShip.cardId,
            targetPlayer,
            rawDamage: damage,
            defenseReduction: 0,
            finalDamage: damage,
            targetNewHull: newHull,
            damageType: 'ability'
          }
        })

        if (newHull <= 0) {
          events.push({
            type: 'SHIP_DESTROYED',
            data: {
              timestamp: ts,
              battleId: battle.battleId,
              cardId: targetShip.cardId,
              owner: targetPlayer,
              position: targetShip.position,
              destroyedBy: `ability:${ability.id}`
            }
          })
        }
      }
      break
    }

    case 'damage_flagship': {
      const targetPlayer = context.sourcePlayer === 'player' ? 'opponent' : 'player'
      const flagship = battle[targetPlayer].flagship
      const damage = effect.amount
      const newHull = Math.max(0, flagship.currentHull - damage)

      events.push({
        type: 'FLAGSHIP_DAMAGED',
        data: {
          timestamp: ts,
          battleId: battle.battleId,
          player: targetPlayer,
          amount: damage,
          newHull,
          source: `ability:${ability.id}`
        }
      })

      if (newHull <= 0) {
        events.push({
          type: 'FLAGSHIP_DESTROYED',
          data: {
            timestamp: ts,
            battleId: battle.battleId,
            player: targetPlayer,
            destroyedBy: `ability:${ability.id}`
          }
        })
      }
      break
    }

    // ========================================================================
    // Defensive Effects
    // ========================================================================
    case 'repair': {
      for (const target of targets) {
        if (target.type === 'ship') {
          const targetShip = target.ship!
          const healAmount = Math.min(effect.amount, targetShip.maxHull - targetShip.currentHull)
          if (healAmount > 0) {
            events.push({
              type: 'DAMAGE_DEALT', // Using negative damage for healing
              data: {
                timestamp: ts,
                battleId: battle.battleId,
                sourceId: sourceShip.cardId,
                targetId: targetShip.cardId,
                targetPlayer: target.player,
                rawDamage: -healAmount,
                defenseReduction: 0,
                finalDamage: -healAmount,
                targetNewHull: targetShip.currentHull + healAmount,
                damageType: 'ability'
              }
            })
          }
        }
      }
      break
    }

    case 'repair_flagship': {
      const targetPlayer = context.sourcePlayer // Repair own flagship
      const flagship = battle[targetPlayer].flagship
      const healAmount = Math.min(effect.amount, flagship.maxHull - flagship.currentHull)
      if (healAmount > 0) {
        events.push({
          type: 'FLAGSHIP_DAMAGED', // Using negative for healing
          data: {
            timestamp: ts,
            battleId: battle.battleId,
            player: targetPlayer,
            amount: -healAmount,
            newHull: flagship.currentHull + healAmount,
            source: `ability:${ability.id}`
          }
        })
      }
      break
    }

    case 'shield': {
      for (const target of targets) {
        if (target.type === 'ship') {
          events.push({
            type: 'STATUS_APPLIED',
            data: {
              timestamp: ts,
              battleId: battle.battleId,
              targetId: target.ship!.cardId,
              targetPlayer: target.player,
              status: 'shielded' as StatusEffectType,
              duration: effect.duration,
              source: sourceShip.cardId
            }
          })
        }
      }
      break
    }

    // ========================================================================
    // Control Effects
    // ========================================================================
    case 'stun': {
      for (const target of targets) {
        if (target.type === 'ship') {
          events.push({
            type: 'STATUS_APPLIED',
            data: {
              timestamp: ts,
              battleId: battle.battleId,
              targetId: target.ship!.cardId,
              targetPlayer: target.player,
              status: 'stunned' as StatusEffectType,
              duration: effect.duration,
              source: sourceShip.cardId
            }
          })
        }
      }
      break
    }

    case 'taunt': {
      events.push({
        type: 'STATUS_APPLIED',
        data: {
          timestamp: ts,
          battleId: battle.battleId,
          targetId: sourceShip.cardId,
          targetPlayer: context.sourcePlayer,
          status: 'taunting' as StatusEffectType,
          duration: effect.duration,
          source: sourceShip.cardId
        }
      })
      break
    }

    // ========================================================================
    // Buff/Debuff Effects (applied as status effects)
    // ========================================================================
    case 'boost_attack':
    case 'boost_defense':
    case 'reduce_attack':
    case 'reduce_defense': {
      // These are tracked as status effects with stacks
      const statusType = effect.type.includes('boost') ? 'energized' : 'marked'
      for (const target of targets) {
        if (target.type === 'ship') {
          events.push({
            type: 'STATUS_APPLIED',
            data: {
              timestamp: ts,
              battleId: battle.battleId,
              targetId: target.ship!.cardId,
              targetPlayer: target.player,
              status: statusType as StatusEffectType,
              duration: effect.duration,
              source: sourceShip.cardId
            }
          })
        }
      }
      break
    }

    case 'energy_drain': {
      const targetPlayer = context.sourcePlayer === 'player' ? 'opponent' : 'player'
      const currentEnergy = battle[targetPlayer].energy.current
      const drainAmount = Math.min(effect.amount, currentEnergy)
      if (drainAmount > 0) {
        events.push({
          type: 'ENERGY_SPENT',
          data: {
            timestamp: ts,
            battleId: battle.battleId,
            player: targetPlayer,
            amount: drainAmount,
            newTotal: currentEnergy - drainAmount,
            action: 'ability'
          }
        })
      }
      break
    }

    // ========================================================================
    // Utility Effects
    // ========================================================================
    case 'draw_card': {
      const deck = battle[context.sourcePlayer].deck
      const hand = battle[context.sourcePlayer].hand
      if (deck.length > 0 && hand.length < 5) {
        events.push({
          type: 'TACTICAL_CARD_DRAWN',
          data: {
            timestamp: ts,
            battleId: battle.battleId,
            player: context.sourcePlayer,
            cardId: deck[0],
            deckRemaining: deck.length - 1
          }
        })
      }
      break
    }

    // Multi-effect: recursively process each sub-effect
    case 'multi': {
      for (const subEffect of effect.effects) {
        const subAbility: CardAbility = { ...ability, effect: subEffect }
        const subEvents = processEffect(battle, subAbility, sourceShip, context, ts)
        events.push(...subEvents)
      }
      break
    }

    // Conditional effect: check condition first
    case 'conditional': {
      if (checkCondition(effect.condition, battle, sourceShip, context)) {
        const condAbility: CardAbility = { ...ability, effect: effect.effect }
        const condEvents = processEffect(battle, condAbility, sourceShip, context, ts)
        events.push(...condEvents)
      }
      break
    }

    default:
      // Unknown effect type - log warning but don't crash
      console.warn(`Unknown ability effect type: ${(effect as AbilityEffect).type}`)
  }

  return events
}

// ----------------------------------------------------------------------------
// Target Resolution
// ----------------------------------------------------------------------------

interface ResolvedTarget {
  type: 'ship' | 'flagship'
  ship?: ShipState
  player: 'player' | 'opponent'
}

function resolveTargets(
  battle: TacticalBattleState,
  ability: CardAbility,
  sourceShip: ShipState,
  context: TriggerContext
): ResolvedTarget[] {
  const targets: ResolvedTarget[] = []
  const enemyPlayer = context.sourcePlayer === 'player' ? 'opponent' : 'player'

  switch (ability.targetType) {
    case 'self':
      targets.push({ type: 'ship', ship: sourceShip, player: context.sourcePlayer })
      break

    case 'enemy':
      // If there's a specific target in context, use it
      if (context.targetShipId && context.targetPlayer) {
        const targetShip = findShip(battle, context.targetShipId, context.targetPlayer)
        if (targetShip) {
          targets.push({ type: 'ship', ship: targetShip, player: context.targetPlayer })
        }
      }
      break

    case 'ally':
      // Find a random ally (not self)
      const allies = battle[context.sourcePlayer].battlefield.filter(
        s => s && s.cardId !== sourceShip.cardId
      )
      if (allies.length > 0) {
        const randomAlly = allies[Math.floor(Math.random() * allies.length)]!
        targets.push({ type: 'ship', ship: randomAlly, player: context.sourcePlayer })
      }
      break

    case 'all_enemies':
      for (const ship of battle[enemyPlayer].battlefield) {
        if (ship) {
          targets.push({ type: 'ship', ship, player: enemyPlayer })
        }
      }
      break

    case 'all_allies':
      for (const ship of battle[context.sourcePlayer].battlefield) {
        if (ship) {
          targets.push({ type: 'ship', ship, player: context.sourcePlayer })
        }
      }
      break

    case 'adjacent':
      const adjacentShips = getAdjacentShips(battle, sourceShip)
      for (const ship of adjacentShips) {
        targets.push({ type: 'ship', ship, player: enemyPlayer })
      }
      break

    case 'flagship':
      targets.push({ type: 'flagship', player: enemyPlayer })
      break

    case 'any_card':
      // For manual targeting - would be specified in context
      if (context.targetShipId && context.targetPlayer) {
        const targetShip = findShip(battle, context.targetShipId, context.targetPlayer)
        if (targetShip) {
          targets.push({ type: 'ship', ship: targetShip, player: context.targetPlayer })
        }
      }
      break
  }

  return targets
}

// ----------------------------------------------------------------------------
// Condition Checking
// ----------------------------------------------------------------------------

function checkCondition(
  condition: { type: string; [key: string]: unknown },
  battle: TacticalBattleState,
  sourceShip: ShipState,
  context: TriggerContext
): boolean {
  switch (condition.type) {
    case 'hull_below': {
      const percentage = condition.percentage as number
      return (sourceShip.currentHull / sourceShip.maxHull) * 100 < percentage
    }
    case 'hull_above': {
      const percentage = condition.percentage as number
      return (sourceShip.currentHull / sourceShip.maxHull) * 100 > percentage
    }
    case 'energy_above': {
      const amount = condition.amount as number
      return battle[context.sourcePlayer].energy.current > amount
    }
    case 'allies_count': {
      const count = condition.count as number
      const comparison = condition.comparison as 'gt' | 'lt' | 'eq'
      const allyCount = battle[context.sourcePlayer].battlefield.filter(s => s !== null).length
      switch (comparison) {
        case 'gt': return allyCount > count
        case 'lt': return allyCount < count
        case 'eq': return allyCount === count
      }
      break
    }
    case 'enemies_count': {
      const count = condition.count as number
      const comparison = condition.comparison as 'gt' | 'lt' | 'eq'
      const enemyPlayer = context.sourcePlayer === 'player' ? 'opponent' : 'player'
      const enemyCount = battle[enemyPlayer].battlefield.filter(s => s !== null).length
      switch (comparison) {
        case 'gt': return enemyCount > count
        case 'lt': return enemyCount < count
        case 'eq': return enemyCount === count
      }
      break
    }
    case 'card_destroyed_this_turn':
      return battle[context.sourcePlayer].shipsDestroyedThisTurn > 0
    default:
      return true
  }
  return false
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

function findShip(
  battle: TacticalBattleState,
  cardId: string,
  player: 'player' | 'opponent'
): ShipState | null {
  return battle[player].battlefield.find(s => s?.cardId === cardId) ?? null
}

function getAllEnemyShips(
  battle: TacticalBattleState,
  sourcePlayer: 'player' | 'opponent'
): ShipState[] {
  const enemyPlayer = sourcePlayer === 'player' ? 'opponent' : 'player'
  return battle[enemyPlayer].battlefield.filter((s): s is ShipState => s !== null)
}

function getAdjacentShips(
  battle: TacticalBattleState,
  sourceShip: ShipState
): ShipState[] {
  const adjacent: ShipState[] = []
  const pos = sourceShip.position

  // Check position to the left
  if (pos > 1) {
    const leftShip = battle.opponent.battlefield[pos - 2]
    if (leftShip) adjacent.push(leftShip)
  }

  // Check position to the right
  if (pos < 5) {
    const rightShip = battle.opponent.battlefield[pos]
    if (rightShip) adjacent.push(rightShip)
  }

  return adjacent
}

// ----------------------------------------------------------------------------
// Passive Ability Modifiers
// ----------------------------------------------------------------------------

/**
 * Calculate stat modifiers from passive abilities.
 * Called during damage calculation.
 */
export function getPassiveModifiers(
  battle: TacticalBattleState,
  shipId: string,
  player: 'player' | 'opponent'
): { attackMod: number; defenseMod: number } {
  const ship = findShip(battle, shipId, player)
  if (!ship) return { attackMod: 0, defenseMod: 0 }

  let attackMod = 0
  let defenseMod = 0

  // Check passive abilities on this ship
  const passiveAbilities = ship.card.abilities?.filter(a => a.trigger === 'passive') ?? []

  for (const ability of passiveAbilities) {
    const effect = ability.effect

    switch (effect.type) {
      case 'boost_attack':
        attackMod += effect.amount
        break
      case 'boost_defense':
        defenseMod += effect.amount
        break
      case 'reduce_attack':
        attackMod -= effect.amount
        break
      case 'reduce_defense':
        defenseMod -= effect.amount
        break
    }
  }

  // Check status effects that modify stats
  for (const status of ship.statusEffects) {
    // Could add status-based modifiers here
  }

  return { attackMod, defenseMod }
}

/**
 * Check if a ship can act (not stunned, etc.).
 */
export function canShipAct(
  battle: TacticalBattleState,
  shipId: string,
  player: 'player' | 'opponent'
): boolean {
  const ship = findShip(battle, shipId, player)
  if (!ship) return false

  // Check for stun status
  const isStunned = ship.statusEffects.some(s => s.type === 'stunned')
  if (isStunned) return false

  return !ship.isExhausted
}

/**
 * Process status effect duration at turn start.
 * Returns events for expired statuses.
 */
export function processStatusDurations(
  battle: TacticalBattleState,
  player: 'player' | 'opponent'
): GameEvent[] {
  const events: GameEvent[] = []
  const ts = timestamp()

  for (const ship of battle[player].battlefield) {
    if (!ship) continue

    for (const status of ship.statusEffects) {
      if (status.duration > 0) {
        // Duration will be decremented by projection
        // If it would reach 0, generate expiry event
        if (status.duration === 1) {
          events.push({
            type: 'STATUS_EXPIRED',
            data: {
              timestamp: ts,
              battleId: battle.battleId,
              targetId: ship.cardId,
              status: status.type
            }
          })
        }
      }
    }
  }

  return events
}
