// ============================================================================
// SPACE FORTRESS - Opponent AI Decision Engine
// ============================================================================
//
// A simple rule-based decision engine for the opponent in tactical battles.
// Priority: Deploy highest-cost affordable cards → Attack with all ships → End turn
//
// This is NOT real AI, just a straightforward decision matrix.
// ============================================================================

import type { TacticalBattleState, ShipState } from './types'
import type { GameEvent } from './events'
import { getCardById } from './content/cards'

function timestamp(): string {
  return new Date().toISOString()
}

// ----------------------------------------------------------------------------
// Main Decision Engine
// ----------------------------------------------------------------------------

/**
 * Generate all events for the opponent's turn.
 * The AI will:
 * 1. Deploy affordable cards (highest cost first, center positions preferred)
 * 2. Attack with all non-exhausted ships (target: opposite slot > weakest > flagship)
 * 3. End turn
 */
export function generateOpponentTurnEvents(
  battle: TacticalBattleState
): GameEvent[] {
  const ts = timestamp()
  const events: GameEvent[] = []

  // Simulate the battle state as we make decisions
  let currentEnergy = battle.opponent.energy.current
  let currentHand = [...battle.opponent.hand]
  const currentBattlefield = [...battle.opponent.battlefield]
  const playerBattlefield = [...battle.player.battlefield]
  let playerFlagshipHull = battle.player.flagship.currentHull

  // Phase 1: Deploy cards (highest cost first, center positions preferred)
  const preferredPositions = [3, 2, 4, 1, 5] // Center first

  while (currentHand.length > 0) {
    // Get affordable cards sorted by energy cost (highest first)
    const affordableCards = currentHand
      .map(cardId => getCardById(cardId))
      .filter(card => card && card.energyCost <= currentEnergy)
      .sort((a, b) => (b?.energyCost ?? 0) - (a?.energyCost ?? 0))

    if (affordableCards.length === 0) break

    // Find an empty slot
    const emptySlot = preferredPositions.find(
      pos => currentBattlefield[pos - 1] === null
    )

    if (emptySlot === undefined) break // No empty slots

    const cardToDeploy = affordableCards[0]!
    const cardIndex = currentHand.indexOf(cardToDeploy.id)
    if (cardIndex === -1) break

    const newEnergy = currentEnergy - cardToDeploy.energyCost

    // Generate energy spent event
    events.push({
      type: 'ENERGY_SPENT',
      data: {
        timestamp: ts,
        battleId: battle.battleId,
        player: 'opponent',
        amount: cardToDeploy.energyCost,
        newTotal: newEnergy,
        action: 'deploy'
      }
    })

    // Generate deployment event
    events.push({
      type: 'SHIP_DEPLOYED',
      data: {
        timestamp: ts,
        battleId: battle.battleId,
        player: 'opponent',
        cardId: cardToDeploy.id,
        position: emptySlot,
        energyCost: cardToDeploy.energyCost
      }
    })

    // Update local state
    currentEnergy = newEnergy
    currentHand.splice(cardIndex, 1)
    currentBattlefield[emptySlot - 1] = {
      cardId: cardToDeploy.id,
      card: cardToDeploy,
      position: emptySlot as 1 | 2 | 3 | 4 | 5,
      currentHull: cardToDeploy.hull,
      maxHull: cardToDeploy.hull,
      isExhausted: true, // Deployed ships are exhausted
      statusEffects: [],
      abilityCooldowns: {}
    }
  }

  // Phase 2: Attack with non-exhausted ships
  // Ships already on the battlefield from previous turns can attack
  for (let pos = 0; pos < 5; pos++) {
    const ship = battle.opponent.battlefield[pos]
    if (!ship || ship.isExhausted) continue

    // Find target (priority: opposite slot > weakest enemy ship > flagship)
    const targetInfo = selectAttackTarget(
      pos + 1,
      playerBattlefield as (ShipState | null)[],
      playerFlagshipHull
    )

    if (!targetInfo) continue

    // Calculate damage
    const damageAmount = ship.card.attack

    if (targetInfo.type === 'flagship') {
      // Attack flagship
      events.push({
        type: 'SHIP_ATTACKED',
        data: {
          timestamp: ts,
          battleId: battle.battleId,
          attackerId: ship.cardId,
          attackerPlayer: 'opponent',
          targetId: 'flagship',
          targetPlayer: 'player'
        }
      })

      const newHull = Math.max(0, playerFlagshipHull - damageAmount)

      events.push({
        type: 'DAMAGE_DEALT',
        data: {
          timestamp: ts,
          battleId: battle.battleId,
          sourceId: ship.cardId,
          targetId: 'flagship',
          targetPlayer: 'player',
          rawDamage: damageAmount,
          defenseReduction: 0,
          finalDamage: damageAmount,
          targetNewHull: newHull,
          damageType: 'attack'
        }
      })

      playerFlagshipHull = newHull

      // Check if flagship destroyed
      if (newHull <= 0) {
        events.push({
          type: 'FLAGSHIP_DAMAGED',
          data: {
            timestamp: ts,
            battleId: battle.battleId,
            player: 'player',
            amount: damageAmount,
            newHull: 0,
            source: ship.cardId
          }
        })

        events.push({
          type: 'FLAGSHIP_DESTROYED',
          data: {
            timestamp: ts,
            battleId: battle.battleId,
            player: 'player',
            destroyedBy: ship.cardId
          }
        })

        events.push({
          type: 'TACTICAL_BATTLE_RESOLVED',
          data: {
            timestamp: ts,
            battleId: battle.battleId,
            winner: 'opponent',
            victoryCondition: 'flagship_destroyed',
            turnsPlayed: battle.turnNumber,
            playerFinalHull: 0,
            opponentFinalHull: battle.opponent.flagship.currentHull,
            playerShipsDestroyed: 0,
            opponentShipsDestroyed: 0
          }
        })
        return events // Battle is over
      }
    } else {
      // Attack enemy ship
      const targetShip = playerBattlefield[targetInfo.position - 1]
      if (!targetShip) continue

      events.push({
        type: 'SHIP_ATTACKED',
        data: {
          timestamp: ts,
          battleId: battle.battleId,
          attackerId: ship.cardId,
          attackerPlayer: 'opponent',
          targetId: targetShip.cardId,
          targetPlayer: 'player'
        }
      })

      const newHull = Math.max(0, targetShip.currentHull - damageAmount)

      events.push({
        type: 'DAMAGE_DEALT',
        data: {
          timestamp: ts,
          battleId: battle.battleId,
          sourceId: ship.cardId,
          targetId: targetShip.cardId,
          targetPlayer: 'player',
          rawDamage: damageAmount,
          defenseReduction: 0,
          finalDamage: damageAmount,
          targetNewHull: newHull,
          damageType: 'attack'
        }
      })

      // Update local tracking
      if (newHull <= 0) {
        playerBattlefield[targetInfo.position - 1] = null

        events.push({
          type: 'SHIP_DESTROYED',
          data: {
            timestamp: ts,
            battleId: battle.battleId,
            cardId: targetShip.cardId,
            owner: 'player',
            position: targetInfo.position,
            destroyedBy: ship.cardId
          }
        })

        // Check for fleet elimination victory
        const playerHasCards = playerBattlefield.some(s => s !== null) ||
          battle.player.hand.length > 0 ||
          battle.player.deck.length > 0

        if (!playerHasCards) {
          events.push({
            type: 'TACTICAL_BATTLE_RESOLVED',
            data: {
              timestamp: ts,
              battleId: battle.battleId,
              winner: 'opponent',
              victoryCondition: 'fleet_eliminated',
              turnsPlayed: battle.turnNumber,
              playerFinalHull: playerFlagshipHull,
              opponentFinalHull: battle.opponent.flagship.currentHull,
              playerShipsDestroyed: 0,
              opponentShipsDestroyed: 0
            }
          })
          return events // Battle is over
        }
      } else {
        (playerBattlefield[targetInfo.position - 1] as ShipState).currentHull = newHull
      }
    }
  }

  // Phase 3: End opponent turn and start player turn
  events.push({
    type: 'TACTICAL_TURN_ENDED',
    data: {
      timestamp: ts,
      battleId: battle.battleId,
      player: 'opponent',
      turnNumber: battle.turnNumber
    }
  })

  // Start player's turn with energy regeneration
  const ENERGY_REGENERATION = 2
  const playerNewEnergy = Math.min(
    battle.player.energy.maximum,
    battle.player.energy.current + ENERGY_REGENERATION
  )

  events.push({
    type: 'TACTICAL_TURN_STARTED',
    data: {
      timestamp: ts,
      battleId: battle.battleId,
      turnNumber: battle.turnNumber + 1,
      activePlayer: 'player',
      energyGained: ENERGY_REGENERATION,
      newEnergyTotal: playerNewEnergy
    }
  })

  // Draw card for player at start of turn (if deck not empty and hand not full)
  if (battle.player.deck.length > 0 && battle.player.hand.length < 5) {
    events.push({
      type: 'TACTICAL_CARD_DRAWN',
      data: {
        timestamp: ts,
        battleId: battle.battleId,
        player: 'player',
        cardId: battle.player.deck[0], // First card from deck
        deckRemaining: battle.player.deck.length - 1
      }
    })
  }

  return events
}

// ----------------------------------------------------------------------------
// Target Selection
// ----------------------------------------------------------------------------

interface TargetInfo {
  type: 'ship' | 'flagship'
  position: number // 0 for flagship
}

/**
 * Select the best target for an attack.
 * Priority:
 * 1. Opposite position (if enemy ship there)
 * 2. Weakest enemy ship (lowest hull)
 * 3. Flagship (if no ships)
 */
function selectAttackTarget(
  attackerPosition: number,
  playerBattlefield: (ShipState | null)[],
  playerFlagshipHull: number
): TargetInfo | null {
  // Check opposite position first
  const oppositeIndex = attackerPosition - 1
  const oppositeShip = playerBattlefield[oppositeIndex]
  if (oppositeShip && oppositeShip.currentHull > 0) {
    return { type: 'ship', position: attackerPosition }
  }

  // Find weakest enemy ship
  let weakestShip: { position: number; hull: number } | null = null
  for (let i = 0; i < 5; i++) {
    const ship = playerBattlefield[i]
    if (ship && ship.currentHull > 0) {
      if (!weakestShip || ship.currentHull < weakestShip.hull) {
        weakestShip = { position: i + 1, hull: ship.currentHull }
      }
    }
  }

  if (weakestShip) {
    return { type: 'ship', position: weakestShip.position }
  }

  // No ships - attack flagship if it's still alive
  if (playerFlagshipHull > 0) {
    return { type: 'flagship', position: 0 }
  }

  return null
}
