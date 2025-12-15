// ============================================================================
// MEDIATION SLICE - Read Model
// ============================================================================
//
// Projects the mediation view from events for the mediation screen.
//
// Displays:
// - Facilitator introduction
// - Two-column faction positions
// - Lean toward options with previews
// - Current leaned state
//
// Note: Full mediation view with content data delegates to legacy projection.
// This slice projection focuses on the core mediation state.
// ============================================================================

import type { GameEvent } from '../../game/events'
import type { FactionId } from '../../game/types'

// ----------------------------------------------------------------------------
// View Types
// ----------------------------------------------------------------------------

export interface MediationStateView {
  // Identification
  mediationId: string | null
  questId: string | null

  // Parties in dispute
  parties: [FactionId, FactionId] | null

  // Player choices
  hasLeaned: boolean
  leanedToward: FactionId | null

  // Phase
  isActive: boolean
  isCollapsed: boolean
  isResolved: boolean
}

// ----------------------------------------------------------------------------
// Projection State
// ----------------------------------------------------------------------------

interface MediationProjectionState {
  mediationId: string | null
  questId: string | null
  parties: [FactionId, FactionId] | null
  hasLeaned: boolean
  leanedToward: FactionId | null
  isCollapsed: boolean
  isResolved: boolean
}

// ----------------------------------------------------------------------------
// Projection Factory
// ----------------------------------------------------------------------------

export function createMediationProjection() {
  const initialState: MediationProjectionState = {
    mediationId: null,
    questId: null,
    parties: null,
    hasLeaned: false,
    leanedToward: null,
    isCollapsed: false,
    isResolved: false
  }

  function reducer(state: MediationProjectionState, event: GameEvent): MediationProjectionState {
    switch (event.type) {
      case 'MEDIATION_STARTED':
        return {
          ...state,
          mediationId: event.data.mediationId,
          questId: event.data.questId,
          parties: event.data.partyFactionIds,
          hasLeaned: false,
          leanedToward: null,
          isCollapsed: false,
          isResolved: false
        }

      case 'MEDIATION_LEANED':
        return {
          ...state,
          hasLeaned: true,
          leanedToward: event.data.towardFactionId
        }

      case 'MEDIATION_COLLAPSED':
        return {
          ...state,
          isCollapsed: true
        }

      case 'COMPROMISE_ACCEPTED':
        return {
          ...state,
          isResolved: true
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

export function buildMediationStateView(state: MediationProjectionState): MediationStateView {
  return {
    mediationId: state.mediationId,
    questId: state.questId,
    parties: state.parties,
    hasLeaned: state.hasLeaned,
    leanedToward: state.leanedToward,
    isActive: state.mediationId !== null && !state.isCollapsed && !state.isResolved,
    isCollapsed: state.isCollapsed,
    isResolved: state.isResolved
  }
}

// ----------------------------------------------------------------------------
// Convenience Projections
// ----------------------------------------------------------------------------

export function projectMediationStateFromEvents(events: GameEvent[]): MediationStateView {
  const { initialState, reducer } = createMediationProjection()
  const state = events.reduce(reducer, initialState)
  return buildMediationStateView(state)
}

// ----------------------------------------------------------------------------
// Legacy API Adapter
// ----------------------------------------------------------------------------

/**
 * Legacy adapter for backward compatibility with existing UI.
 * This delegates to the existing mediationView projection for full functionality
 * including content data (facilitator, parties, lean options).
 */
export { projectMediationView } from '../../game/projections/mediationView'
export type {
  MediationViewData,
  MediationPartyView,
  LeanOptionView,
  FacilitatorView,
  ReputationEffectPreview
} from '../../game/projections/mediationView'
