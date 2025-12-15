// ============================================================================
// CONSEQUENCE SLICE - Public API
// ============================================================================
//
// Exports command handlers and read model for consequence phase.
//
// Commands:
// - ACKNOWLEDGE_OUTCOME: Player acknowledges battle/mediation outcome
// - CONTINUE_TO_NEXT_PHASE: Player continues to next phase
// ============================================================================

// Command exports
export {
  handleAcknowledgeOutcome,
  handleContinueToNextPhase,
  createAcknowledgeOutcomeCommand,
  createContinueToNextPhaseCommand,
  ConsequenceError
} from './command'

export type {
  AcknowledgeOutcomeCommand,
  ContinueToNextPhaseCommand,
  ConsequenceCommand,
  ConsequenceState
} from './command'

// Read model exports
export {
  createConsequenceProjection,
  buildConsequenceStateView,
  projectConsequenceStateFromEvents,
  // Legacy API re-exports
  projectConsequenceView
} from './read-model'

export type {
  ConsequenceStateView,
  // Legacy types
  ConsequenceViewData,
  BountyBreakdownView,
  BountyShareView,
  BountyModifierView,
  ReputationChangeView,
  CardChangeView
} from './read-model'
