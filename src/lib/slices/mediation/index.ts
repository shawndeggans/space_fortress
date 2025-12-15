// ============================================================================
// MEDIATION SLICE - Public API
// ============================================================================
//
// Exports command handlers and read model for mediation phase.
//
// Commands:
// - LEAN_TOWARD_FACTION: Show preference for one faction
// - REFUSE_TO_LEAN: Reject mediation, triggering battle
// - ACCEPT_COMPROMISE: Accept negotiated settlement
// ============================================================================

// Command exports
export {
  handleLeanTowardFaction,
  handleRefuseToLean,
  handleAcceptCompromise,
  createLeanTowardFactionCommand,
  createRefuseToLeanCommand,
  createAcceptCompromiseCommand,
  MediationError
} from './command'

export type {
  LeanTowardFactionCommand,
  RefuseToLeanCommand,
  AcceptCompromiseCommand,
  MediationCommand,
  MediationState
} from './command'

// Read model exports
export {
  createMediationProjection,
  buildMediationStateView,
  projectMediationStateFromEvents,
  // Legacy API re-exports
  projectMediationView
} from './read-model'

export type {
  MediationStateView,
  // Legacy types
  MediationViewData,
  MediationPartyView,
  LeanOptionView,
  FacilitatorView,
  ReputationEffectPreview
} from './read-model'
