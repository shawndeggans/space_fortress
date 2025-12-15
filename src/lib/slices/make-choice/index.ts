// ============================================================================
// MAKE-CHOICE SLICE - Public API
// ============================================================================
//
// This module exports the public API for the make-choice slice.
//
// The make-choice slice handles:
// - Displaying narrative dilemmas with choices
// - Processing the MAKE_CHOICE command
// - Applying consequences (reputation, cards, bounty, flags)
// - Transitioning to appropriate next phase
// ============================================================================

// ----------------------------------------------------------------------------
// Command Handler
// ----------------------------------------------------------------------------

export {
  handleMakeChoice,
  createMakeChoiceCommand,
  MakeChoiceError,
  type MakeChoiceCommand,
  type MakeChoiceState
} from './command'

// ----------------------------------------------------------------------------
// Read Model
// ----------------------------------------------------------------------------

export {
  // View types
  type VoiceData,
  type ReputationPreview,
  type CardImpactPreview,
  type ChoiceData,
  type DilemmaView,
  type DilemmaViewData, // Legacy type alias

  // Projection factory
  createMakeChoiceProjection,

  // View builders
  buildDilemmaView,

  // Convenience projections (pure event-sourced)
  projectDilemmaFromEvents,

  // Legacy API adapters (for backward compatibility with existing UI)
  projectDilemmaView
} from './read-model'
