// ============================================================================
// CARD-SELECTION SLICE - Public API
// ============================================================================
//
// This module exports the public API for the card-selection slice.
//
// The card-selection slice handles:
// - Selecting cards for battle
// - Deselecting cards from fleet
// - Committing the final fleet for deployment
// ============================================================================

// ----------------------------------------------------------------------------
// Command Handlers
// ----------------------------------------------------------------------------

export {
  handleSelectCard,
  handleDeselectCard,
  handleCommitFleet,
  createSelectCardCommand,
  createDeselectCardCommand,
  createCommitFleetCommand,
  CardSelectionError,
  MAX_FLEET_SIZE,
  type SelectCardCommand,
  type DeselectCardCommand,
  type CommitFleetCommand,
  type CardSelectionCommand,
  type CardSelectionState
} from './command'

// ----------------------------------------------------------------------------
// Read Model
// ----------------------------------------------------------------------------

export {
  // View types
  type CardViewData,
  type CardBattleHistoryView,
  type EnemyFleetPreview,
  type CardPoolView,

  // Projection factory
  createCardSelectionProjection,

  // View builders
  buildCardPoolView,

  // Convenience projections (pure event-sourced)
  projectCardPoolFromEvents,

  // Legacy API adapter (for backward compatibility with existing UI)
  projectCardPoolView
} from './read-model'
