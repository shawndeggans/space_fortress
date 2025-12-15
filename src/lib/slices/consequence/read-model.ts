// ============================================================================
// CONSEQUENCE SLICE - Read Model
// ============================================================================
//
// Projects the consequence view from events for the consequence screen.
//
// Displays:
// - Battle outcome (victory/defeat/draw)
// - Bounty breakdown
// - Reputation changes
// - Cards gained/lost
// - Next step indicator
//
// Note: Full consequence view with content data delegates to legacy projection.
// This slice projection focuses on the core consequence state.
// ============================================================================

import type { GameEvent } from '../../game/events'
import type { BattleOutcome } from '../../game/types'

// ----------------------------------------------------------------------------
// View Types
// ----------------------------------------------------------------------------

export interface ConsequenceStateView {
  // Battle info
  battleId: string | null
  outcome: BattleOutcome | null

  // State tracking
  hasAcknowledged: boolean
  isComplete: boolean

  // Next step
  nextStep: 'continue_quest' | 'quest_complete' | 'unknown'
}

// ----------------------------------------------------------------------------
// Projection State
// ----------------------------------------------------------------------------

interface ConsequenceProjectionState {
  battleId: string | null
  outcome: BattleOutcome | null
  hasAcknowledged: boolean
  questCompleted: boolean
}

// ----------------------------------------------------------------------------
// Projection Factory
// ----------------------------------------------------------------------------

export function createConsequenceProjection() {
  const initialState: ConsequenceProjectionState = {
    battleId: null,
    outcome: null,
    hasAcknowledged: false,
    questCompleted: false
  }

  function reducer(state: ConsequenceProjectionState, event: GameEvent): ConsequenceProjectionState {
    switch (event.type) {
      case 'BATTLE_RESOLVED':
        return {
          ...state,
          battleId: event.data.battleId,
          outcome: event.data.outcome,
          hasAcknowledged: false
        }

      case 'COMPROMISE_ACCEPTED':
        // Mediation resolution also leads to consequence phase
        return {
          ...state,
          outcome: 'victory', // Compromise counts as a win
          hasAcknowledged: false
        }

      case 'OUTCOME_ACKNOWLEDGED':
        if (state.battleId && state.battleId === event.data.battleId) {
          return {
            ...state,
            hasAcknowledged: true
          }
        }
        return state

      case 'QUEST_COMPLETED':
        return {
          ...state,
          questCompleted: true
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

export function buildConsequenceStateView(state: ConsequenceProjectionState): ConsequenceStateView {
  let nextStep: 'continue_quest' | 'quest_complete' | 'unknown' = 'unknown'

  if (state.questCompleted) {
    nextStep = 'quest_complete'
  } else if (state.hasAcknowledged) {
    nextStep = 'continue_quest'
  }

  return {
    battleId: state.battleId,
    outcome: state.outcome,
    hasAcknowledged: state.hasAcknowledged,
    isComplete: state.hasAcknowledged,
    nextStep
  }
}

// ----------------------------------------------------------------------------
// Convenience Projections
// ----------------------------------------------------------------------------

export function projectConsequenceStateFromEvents(events: GameEvent[]): ConsequenceStateView {
  const { initialState, reducer } = createConsequenceProjection()
  const state = events.reduce(reducer, initialState)
  return buildConsequenceStateView(state)
}

// ----------------------------------------------------------------------------
// Legacy API Adapter
// ----------------------------------------------------------------------------

/**
 * Legacy adapter for backward compatibility with existing UI.
 * This delegates to the existing consequenceView projection for full functionality
 * including bounty breakdown, reputation changes, and card changes.
 */
export { projectConsequenceView } from '../../game/projections/consequenceView'
export type {
  ConsequenceViewData,
  BountyBreakdownView,
  BountyShareView,
  BountyModifierView,
  ReputationChangeView,
  CardChangeView
} from '../../game/projections/consequenceView'
