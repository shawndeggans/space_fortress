// ============================================================================
// CHOICE-CONSEQUENCE SLICE - Public API
// ============================================================================

// Command handler and types
export {
  handleAcknowledgeChoiceConsequence,
  createAcknowledgeChoiceConsequenceCommand,
  ChoiceConsequenceError,
  type AcknowledgeChoiceConsequenceCommand,
  type ChoiceConsequenceCommand,
  type ChoiceConsequenceState
} from './command'

// Read model and projection
export {
  projectChoiceConsequenceView,
  getInitialChoiceConsequenceView,
  type ChoiceConsequenceView,
  type ReputationChangeView,
  type CardChangeView,
  type BountyChangeView
} from './read-model'
