// ============================================================================
// FORM-ALLIANCE SLICE - Public API
// ============================================================================
//
// This module exports the public API for the form-alliance slice.
//
// The form-alliance slice handles:
// - Displaying available alliance options
// - Processing alliance formation commands
// - Validating minimum card requirements
// - Transitioning to card selection phase
// ============================================================================

// ----------------------------------------------------------------------------
// Command Handlers
// ----------------------------------------------------------------------------

export {
  handleFormAlliance,
  handleFinalizeAlliances,
  handleDeclineAllAlliances,
  handleRejectAllianceTerms,
  createFormAllianceCommand,
  createFinalizeAlliancesCommand,
  createDeclineAllAlliancesCommand,
  createRejectAllianceTermsCommand,
  AllianceError,
  type FormAllianceCommand,
  type FinalizeAlliancesCommand,
  type DeclineAllAlliancesCommand,
  type RejectAllianceTermsCommand,
  type AllianceCommand,
  type AllianceState
} from './command'

// ----------------------------------------------------------------------------
// Read Model
// ----------------------------------------------------------------------------

export {
  // View types
  type AllianceOptionView,
  type AllianceOptionsView,
  type CardTermView,
  type ConflictWarningView,
  type AllianceTermsView,
  type AllianceTermsViewData, // Legacy alias

  // Projection factory
  createAllianceProjection,

  // View builders
  buildAllianceOptionsView,
  buildAllianceTermsView,

  // Convenience projections (pure event-sourced)
  projectAllianceOptionsFromEvents,
  projectAllianceTermsFromEvents,

  // Legacy API adapters (for backward compatibility with existing UI)
  projectAllianceOptions,
  projectAllianceTermsView
} from './read-model'
