// ============================================================================
// SPACE FORTRESS - Combat Resolution Engine
// ============================================================================
//
// Core combat mechanics:
// - d20 + Attack vs 10 + Enemy Armor
// - Higher Agility strikes first (tie = simultaneous)
// - 5 rounds, best-of wins the battle
//
// This module generates events during resolution, following the event-sourcing
// pattern. All randomness can be seeded for deterministic testing.
// ============================================================================

import type { GameEvent } from './events'
import type { Card, RoundOutcome, BattleOutcome } from './types'

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface CombatRoll {
  base: number        // d20 result (1-20)
  modifier: number    // attack stat
  total: number       // base + modifier
  target: number      // 10 + enemy armor
  hit: boolean        // total >= target
}

export interface InitiativeResult {
  firstStriker: 'player' | 'opponent' | 'simultaneous'
  playerAgility: number
  opponentAgility: number
}

export interface RoundResolution {
  roundNumber: number
  playerCard: Card
  opponentCard: Card
  initiative: InitiativeResult
  playerRoll: CombatRoll
  opponentRoll: CombatRoll
  outcome: RoundOutcome
}

export interface BattleResolution {
  battleId: string
  rounds: RoundResolution[]
  playerWins: number
  opponentWins: number
  draws: number
  outcome: BattleOutcome
}

export interface BattleContext {
  battleId: string
  questId: string
  context: string
  timestamp: string
}

// ----------------------------------------------------------------------------
// Random Number Generation
// ----------------------------------------------------------------------------

// Seedable RNG for deterministic testing
// Uses a simple linear congruential generator
let rngState: number | null = null

/**
 * Set the RNG seed for deterministic results
 * Pass null to use Math.random() instead
 */
export function setRngSeed(seed: number | null): void {
  rngState = seed
}

/**
 * Get the current RNG state (for debugging/testing)
 */
export function getRngState(): number | null {
  return rngState
}

/**
 * Generate a random number between 0 and 1
 * Uses seeded RNG if set, otherwise Math.random()
 */
function random(): number {
  if (rngState === null) {
    return Math.random()
  }

  // LCG parameters (same as glibc)
  const a = 1103515245
  const c = 12345
  const m = 2 ** 31

  rngState = (a * rngState + c) % m
  return rngState / m
}

/**
 * Roll a d20 (1-20)
 */
export function rollD20(): number {
  return Math.floor(random() * 20) + 1
}

/**
 * Roll multiple d20s and return results
 */
export function rollMultipleD20(count: number): number[] {
  return Array.from({ length: count }, () => rollD20())
}

// ----------------------------------------------------------------------------
// Initiative Resolution
// ----------------------------------------------------------------------------

/**
 * Determine who strikes first based on agility
 * Higher agility = first strike
 * Equal agility = simultaneous attacks
 */
export function resolveInitiative(
  playerAgility: number,
  opponentAgility: number
): InitiativeResult {
  let firstStriker: 'player' | 'opponent' | 'simultaneous'

  if (playerAgility > opponentAgility) {
    firstStriker = 'player'
  } else if (opponentAgility > playerAgility) {
    firstStriker = 'opponent'
  } else {
    firstStriker = 'simultaneous'
  }

  return {
    firstStriker,
    playerAgility,
    opponentAgility
  }
}

// ----------------------------------------------------------------------------
// Attack Resolution
// ----------------------------------------------------------------------------

/**
 * Resolve a single attack roll
 * Hit formula: d20 + Attack >= 10 + Enemy Armor
 */
export function resolveAttack(
  attackerAttack: number,
  defenderArmor: number
): CombatRoll {
  const base = rollD20()
  const modifier = attackerAttack
  const total = base + modifier
  const target = 10 + defenderArmor
  const hit = total >= target

  return {
    base,
    modifier,
    total,
    target,
    hit
  }
}

/**
 * Resolve attack with a predetermined roll (for testing/replay)
 */
export function resolveAttackWithRoll(
  roll: number,
  attackerAttack: number,
  defenderArmor: number
): CombatRoll {
  const base = roll
  const modifier = attackerAttack
  const total = base + modifier
  const target = 10 + defenderArmor
  const hit = total >= target

  return {
    base,
    modifier,
    total,
    target,
    hit
  }
}

// ----------------------------------------------------------------------------
// Round Resolution
// ----------------------------------------------------------------------------

/**
 * Determine round outcome based on hit results
 *
 * Outcomes:
 * - Player hits, opponent misses → player_won
 * - Opponent hits, player misses → opponent_won
 * - Both hit or both miss → draw
 */
export function determineRoundOutcome(
  playerHit: boolean,
  opponentHit: boolean
): RoundOutcome {
  if (playerHit && !opponentHit) {
    return 'player_won'
  } else if (opponentHit && !playerHit) {
    return 'opponent_won'
  } else {
    return 'draw'
  }
}

/**
 * Resolve a single combat round
 */
export function resolveRound(
  roundNumber: number,
  playerCard: Card,
  opponentCard: Card
): RoundResolution {
  // 1. Determine initiative
  const initiative = resolveInitiative(playerCard.agility, opponentCard.agility)

  // 2. Resolve attacks
  // Even though initiative determines narrative order, both attacks happen
  // (unless we implement "first-strike kill" variant later)
  const playerRoll = resolveAttack(playerCard.attack, opponentCard.armor)
  const opponentRoll = resolveAttack(opponentCard.attack, playerCard.armor)

  // 3. Determine round outcome
  const outcome = determineRoundOutcome(playerRoll.hit, opponentRoll.hit)

  return {
    roundNumber,
    playerCard,
    opponentCard,
    initiative,
    playerRoll,
    opponentRoll,
    outcome
  }
}

/**
 * Resolve a round with predetermined rolls (for testing/replay)
 */
export function resolveRoundWithRolls(
  roundNumber: number,
  playerCard: Card,
  opponentCard: Card,
  playerRollValue: number,
  opponentRollValue: number
): RoundResolution {
  const initiative = resolveInitiative(playerCard.agility, opponentCard.agility)

  const playerRoll = resolveAttackWithRoll(
    playerRollValue,
    playerCard.attack,
    opponentCard.armor
  )
  const opponentRoll = resolveAttackWithRoll(
    opponentRollValue,
    opponentCard.attack,
    playerCard.armor
  )

  const outcome = determineRoundOutcome(playerRoll.hit, opponentRoll.hit)

  return {
    roundNumber,
    playerCard,
    opponentCard,
    initiative,
    playerRoll,
    opponentRoll,
    outcome
  }
}

// ----------------------------------------------------------------------------
// Battle Resolution
// ----------------------------------------------------------------------------

/**
 * Determine overall battle outcome
 * Best of 5 rounds (first to 3 wins)
 */
export function determineBattleOutcome(
  playerWins: number,
  opponentWins: number
): BattleOutcome {
  if (playerWins > opponentWins) {
    return 'victory'
  } else if (opponentWins > playerWins) {
    return 'defeat'
  } else {
    return 'draw'
  }
}

/**
 * Resolve a complete 5-round battle
 *
 * @param battleId - Unique identifier for this battle
 * @param playerFleet - Player's 5 cards in position order
 * @param opponentFleet - Opponent's 5 cards in position order
 */
export function resolveBattle(
  battleId: string,
  playerFleet: Card[],
  opponentFleet: Card[]
): BattleResolution {
  if (playerFleet.length !== 5) {
    throw new Error(`Player fleet must have exactly 5 cards, got ${playerFleet.length}`)
  }
  if (opponentFleet.length !== 5) {
    throw new Error(`Opponent fleet must have exactly 5 cards, got ${opponentFleet.length}`)
  }

  const rounds: RoundResolution[] = []
  let playerWins = 0
  let opponentWins = 0
  let draws = 0

  // Resolve each round
  for (let i = 0; i < 5; i++) {
    const round = resolveRound(
      i + 1,  // 1-indexed round numbers
      playerFleet[i],
      opponentFleet[i]
    )

    rounds.push(round)

    // Count results
    if (round.outcome === 'player_won') {
      playerWins++
    } else if (round.outcome === 'opponent_won') {
      opponentWins++
    } else {
      draws++
    }
  }

  const outcome = determineBattleOutcome(playerWins, opponentWins)

  return {
    battleId,
    rounds,
    playerWins,
    opponentWins,
    draws,
    outcome
  }
}

/**
 * Resolve battle with predetermined rolls (for testing)
 */
export function resolveBattleWithRolls(
  battleId: string,
  playerFleet: Card[],
  opponentFleet: Card[],
  rolls: Array<{ player: number; opponent: number }>
): BattleResolution {
  if (playerFleet.length !== 5 || opponentFleet.length !== 5 || rolls.length !== 5) {
    throw new Error('Fleet and rolls must have exactly 5 entries each')
  }

  const rounds: RoundResolution[] = []
  let playerWins = 0
  let opponentWins = 0
  let draws = 0

  for (let i = 0; i < 5; i++) {
    const round = resolveRoundWithRolls(
      i + 1,
      playerFleet[i],
      opponentFleet[i],
      rolls[i].player,
      rolls[i].opponent
    )

    rounds.push(round)

    if (round.outcome === 'player_won') playerWins++
    else if (round.outcome === 'opponent_won') opponentWins++
    else draws++
  }

  return {
    battleId,
    rounds,
    playerWins,
    opponentWins,
    draws,
    outcome: determineBattleOutcome(playerWins, opponentWins)
  }
}

// ----------------------------------------------------------------------------
// Event Generation
// ----------------------------------------------------------------------------

/**
 * Generate all events for a battle resolution
 * This is the key integration point with the event-sourcing architecture
 */
export function generateBattleEvents(
  context: BattleContext,
  playerFleet: Card[],
  opponentFleet: Card[],
  resolution: BattleResolution
): GameEvent[] {
  const events: GameEvent[] = []
  const { battleId, questId, timestamp } = context

  // BATTLE_STARTED event
  events.push({
    type: 'BATTLE_STARTED',
    data: {
      timestamp,
      battleId,
      playerCardIds: playerFleet.map(c => c.id),
      opponentCards: opponentFleet
    }
  })

  // Generate events for each round
  for (const round of resolution.rounds) {
    const roundTimestamp = new Date(
      new Date(timestamp).getTime() + round.roundNumber * 1000
    ).toISOString()

    // ROUND_STARTED
    events.push({
      type: 'ROUND_STARTED',
      data: {
        timestamp: roundTimestamp,
        battleId,
        roundNumber: round.roundNumber
      }
    })

    // CARDS_REVEALED
    events.push({
      type: 'CARDS_REVEALED',
      data: {
        timestamp: roundTimestamp,
        battleId,
        roundNumber: round.roundNumber,
        playerCard: round.playerCard,
        opponentCard: round.opponentCard
      }
    })

    // INITIATIVE_RESOLVED
    events.push({
      type: 'INITIATIVE_RESOLVED',
      data: {
        timestamp: roundTimestamp,
        battleId,
        roundNumber: round.roundNumber,
        firstStriker: round.initiative.firstStriker,
        playerAgility: round.initiative.playerAgility,
        opponentAgility: round.initiative.opponentAgility
      }
    })

    // ATTACK_ROLLED for player
    events.push({
      type: 'ATTACK_ROLLED',
      data: {
        timestamp: roundTimestamp,
        battleId,
        roundNumber: round.roundNumber,
        attacker: 'player',
        roll: round.playerRoll.base,
        modifier: round.playerRoll.modifier,
        total: round.playerRoll.total,
        targetArmor: round.opponentCard.armor,
        targetNumber: round.playerRoll.target,
        hit: round.playerRoll.hit
      }
    })

    // ATTACK_ROLLED for opponent
    events.push({
      type: 'ATTACK_ROLLED',
      data: {
        timestamp: roundTimestamp,
        battleId,
        roundNumber: round.roundNumber,
        attacker: 'opponent',
        roll: round.opponentRoll.base,
        modifier: round.opponentRoll.modifier,
        total: round.opponentRoll.total,
        targetArmor: round.playerCard.armor,
        targetNumber: round.opponentRoll.target,
        hit: round.opponentRoll.hit
      }
    })

    // ROUND_RESOLVED
    events.push({
      type: 'ROUND_RESOLVED',
      data: {
        timestamp: roundTimestamp,
        battleId,
        roundNumber: round.roundNumber,
        playerCard: round.playerCard,
        opponentCard: round.opponentCard,
        playerRoll: {
          base: round.playerRoll.base,
          modifier: round.playerRoll.modifier,
          total: round.playerRoll.total,
          hit: round.playerRoll.hit
        },
        opponentRoll: {
          base: round.opponentRoll.base,
          modifier: round.opponentRoll.modifier,
          total: round.opponentRoll.total,
          hit: round.opponentRoll.hit
        },
        outcome: round.outcome
      }
    })
  }

  // BATTLE_RESOLVED
  const finalTimestamp = new Date(
    new Date(timestamp).getTime() + 6000
  ).toISOString()

  events.push({
    type: 'BATTLE_RESOLVED',
    data: {
      timestamp: finalTimestamp,
      battleId,
      outcome: resolution.outcome,
      playerWins: resolution.playerWins,
      opponentWins: resolution.opponentWins,
      draws: resolution.draws,
      roundsSummary: resolution.rounds.map(r => ({
        roundNumber: r.roundNumber,
        playerCard: r.playerCard,
        opponentCard: r.opponentCard,
        initiative: r.initiative.firstStriker,
        playerRoll: r.playerRoll,
        opponentRoll: r.opponentRoll,
        outcome: r.outcome
      }))
    }
  })

  return events
}

/**
 * Run a complete battle and generate all events
 * This is the main entry point for the combat system
 */
export function executeBattle(
  context: BattleContext,
  playerFleet: Card[],
  opponentFleet: Card[]
): { resolution: BattleResolution; events: GameEvent[] } {
  const resolution = resolveBattle(context.battleId, playerFleet, opponentFleet)
  const events = generateBattleEvents(context, playerFleet, opponentFleet, resolution)

  return { resolution, events }
}
