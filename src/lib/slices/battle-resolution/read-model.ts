// ============================================================================
// BATTLE-RESOLUTION SLICE - Read Model
// ============================================================================
//
// Projects the battle view from events for the battle screen.
//
// Displays:
// - Current round with cards
// - Combat log with rolls
// - Round-by-round results
// - Final battle summary
//
// Note: Battle execution happens automatically via LOCK_ORDERS in deployment slice.
// This slice focuses on the read model for viewing battle progress.
// ============================================================================

import type { GameEvent } from '../../game/events'
import type {
  FactionId,
  Card,
  RoundOutcome,
  BattleOutcome,
  GameState
} from '../../game/types'
import { rebuildState } from '../../game/projections'

// ----------------------------------------------------------------------------
// View Types
// ----------------------------------------------------------------------------

export interface BattleCardView {
  id: string
  name: string
  factionId: FactionId | 'scavengers' | 'pirates'
  factionIcon: string
  attack: number
  defense: number
  agility: number
}

export interface CombatRollView {
  attacker: 'player' | 'opponent'
  attackerName: string
  roll: number  // d20 result
  modifier: number  // attack stat
  total: number
  targetArmor: number
  targetNumber: number  // 10 + armor
  isHit: boolean
}

export interface RoundResultView {
  roundNumber: number
  playerCard: BattleCardView
  opponentCard: BattleCardView
  initiative: 'player' | 'opponent' | 'simultaneous'
  playerRoll: CombatRollView
  opponentRoll: CombatRollView
  outcome: RoundOutcome
  outcomeLabel: string  // "WON", "LOST", "DRAW"
}

export interface BattleView {
  // Battle identification
  battleId: string
  battleContext: string
  opponentName: string

  // Current state
  currentRound: number
  totalRounds: number
  phase: 'in_progress' | 'complete'

  // Score tracking
  playerWins: number
  opponentWins: number
  draws: number

  // All completed rounds
  completedRounds: RoundResultView[]

  // Final outcome (when complete)
  finalOutcome?: BattleOutcome
  outcomeLabel?: string
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const FACTION_ICONS: Record<FactionId | 'scavengers' | 'pirates', string> = {
  ironveil: '▣',
  ashfall: '◈',
  meridian: '⬡',
  void_wardens: '⛊',
  sundered_oath: '✕',
  scavengers: '☠',
  pirates: '⚔'
}

export const TOTAL_ROUNDS = 5

// ----------------------------------------------------------------------------
// Projection State
// ----------------------------------------------------------------------------

interface BattleProjectionState {
  currentBattle: {
    battleId: string
    context: string
    opponentName: string
    currentRound: number
    rounds: RoundResultView[]
    // Track initiative per round from INITIATIVE_RESOLVED events
    roundInitiatives: Map<number, 'player' | 'opponent' | 'simultaneous'>
    outcome?: BattleOutcome
  } | null
}

// ----------------------------------------------------------------------------
// Projection Factory
// ----------------------------------------------------------------------------

export function createBattleProjection() {
  const initialState: BattleProjectionState = {
    currentBattle: null
  }

  function reducer(state: BattleProjectionState, event: GameEvent): BattleProjectionState {
    switch (event.type) {
      case 'BATTLE_TRIGGERED':
        return {
          ...state,
          currentBattle: {
            battleId: event.data.battleId,
            context: event.data.context,
            opponentName: capitalizeFirst(event.data.opponentType) + ' Fleet',
            currentRound: 0,
            rounds: [],
            roundInitiatives: new Map()
          }
        }

      case 'ROUND_STARTED':
        if (!state.currentBattle || state.currentBattle.battleId !== event.data.battleId) {
          return state
        }
        return {
          ...state,
          currentBattle: {
            ...state.currentBattle,
            currentRound: event.data.roundNumber
          }
        }

      case 'INITIATIVE_RESOLVED':
        if (!state.currentBattle || state.currentBattle.battleId !== event.data.battleId) {
          return state
        }
        const newInitiatives = new Map(state.currentBattle.roundInitiatives)
        newInitiatives.set(event.data.roundNumber, event.data.firstStriker)
        return {
          ...state,
          currentBattle: {
            ...state.currentBattle,
            roundInitiatives: newInitiatives
          }
        }

      case 'ROUND_RESOLVED':
        if (!state.currentBattle || state.currentBattle.battleId !== event.data.battleId) {
          return state
        }
        // Get initiative from previously tracked INITIATIVE_RESOLVED event
        const initiative = state.currentBattle.roundInitiatives.get(event.data.roundNumber) || 'simultaneous'
        // Calculate target numbers (10 + armor)
        const playerTargetNumber = 10 + event.data.opponentCard.defense
        const opponentTargetNumber = 10 + event.data.playerCard.defense
        const roundResult: RoundResultView = {
          roundNumber: event.data.roundNumber,
          playerCard: cardToView(event.data.playerCard),
          opponentCard: cardToView(event.data.opponentCard),
          initiative,
          playerRoll: {
            attacker: 'player',
            attackerName: event.data.playerCard.name,
            roll: event.data.playerRoll.base,
            modifier: event.data.playerRoll.modifier,
            total: event.data.playerRoll.total,
            targetArmor: event.data.opponentCard.defense,
            targetNumber: playerTargetNumber,
            isHit: event.data.playerRoll.hit
          },
          opponentRoll: {
            attacker: 'opponent',
            attackerName: event.data.opponentCard.name,
            roll: event.data.opponentRoll.base,
            modifier: event.data.opponentRoll.modifier,
            total: event.data.opponentRoll.total,
            targetArmor: event.data.playerCard.defense,
            targetNumber: opponentTargetNumber,
            isHit: event.data.opponentRoll.hit
          },
          outcome: event.data.outcome,
          outcomeLabel: getOutcomeLabel(event.data.outcome)
        }
        return {
          ...state,
          currentBattle: {
            ...state.currentBattle,
            rounds: [...state.currentBattle.rounds, roundResult]
          }
        }

      case 'BATTLE_RESOLVED':
        if (!state.currentBattle || state.currentBattle.battleId !== event.data.battleId) {
          return state
        }
        return {
          ...state,
          currentBattle: {
            ...state.currentBattle,
            outcome: event.data.outcome
          }
        }

      default:
        return state
    }
  }

  return { initialState, reducer }
}

// ----------------------------------------------------------------------------
// View Builders
// ----------------------------------------------------------------------------

export function buildBattleView(state: BattleProjectionState): BattleView | null {
  if (!state.currentBattle) {
    return null
  }

  const battle = state.currentBattle
  const completedRounds = battle.rounds

  // Calculate scores
  let playerWins = 0
  let opponentWins = 0
  let draws = 0

  for (const round of completedRounds) {
    if (round.outcome === 'player_won') playerWins++
    else if (round.outcome === 'opponent_won') opponentWins++
    else draws++
  }

  const isComplete = !!battle.outcome || completedRounds.length >= TOTAL_ROUNDS

  return {
    battleId: battle.battleId,
    battleContext: battle.context,
    opponentName: battle.opponentName,
    currentRound: battle.currentRound,
    totalRounds: TOTAL_ROUNDS,
    phase: isComplete ? 'complete' : 'in_progress',
    playerWins,
    opponentWins,
    draws,
    completedRounds,
    finalOutcome: battle.outcome,
    outcomeLabel: battle.outcome ? getOutcomeLabelFinal(battle.outcome) : undefined
  }
}

// ----------------------------------------------------------------------------
// Convenience Projections
// ----------------------------------------------------------------------------

export function projectBattleFromEvents(events: GameEvent[]): BattleView | null {
  const { initialState, reducer } = createBattleProjection()
  const state = events.reduce(reducer, initialState)
  return buildBattleView(state)
}

// ----------------------------------------------------------------------------
// Legacy API Adapter
// ----------------------------------------------------------------------------

/**
 * Legacy adapter for backward compatibility with existing UI.
 * This delegates to the existing battleView projection for full functionality.
 */
export { projectBattleView, projectBattleResultView } from '../../game/projections/battleView'

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function cardToView(card: Card): BattleCardView {
  const factionId = card.faction as FactionId | 'scavengers' | 'pirates'
  return {
    id: card.id,
    name: card.name,
    factionId,
    factionIcon: FACTION_ICONS[factionId] || '○',
    attack: card.attack,
    defense: card.defense,
    agility: card.agility
  }
}

function getOutcomeLabel(outcome: RoundOutcome): string {
  switch (outcome) {
    case 'player_won': return 'WON'
    case 'opponent_won': return 'LOST'
    case 'draw': return 'DRAW'
  }
}

function getOutcomeLabelFinal(outcome: BattleOutcome): string {
  switch (outcome) {
    case 'victory': return 'VICTORY'
    case 'defeat': return 'DEFEAT'
    case 'draw': return 'DRAW'
  }
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
