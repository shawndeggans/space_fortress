// ============================================================================
// ACCEPT-QUEST SLICE - Public API
// ============================================================================
//
// This module exports the public API for the accept-quest slice.
//
// The accept-quest slice handles:
// - Displaying available quests in the quest hub
// - Showing quest details for acceptance decision
// - Processing the ACCEPT_QUEST command
// - Transitioning to the narrative phase
// ============================================================================

// ----------------------------------------------------------------------------
// Command Handler
// ----------------------------------------------------------------------------

export {
  handleAcceptQuest,
  createAcceptQuestCommand,
  AcceptQuestError,
  type AcceptQuestCommand,
  type AcceptQuestState
} from './command'

// ----------------------------------------------------------------------------
// Read Model
// ----------------------------------------------------------------------------

export {
  // View types
  type QuestStatus,
  type QuestListItem,
  type CompletedQuestItem,
  type CardPreview,
  type QuestListView,
  type QuestDetailView,

  // Projection factory
  createQuestListProjection,

  // View builders
  buildQuestListView,
  buildQuestDetailView,

  // Convenience projections (pure event-sourced)
  projectQuestListFromEvents,
  projectQuestDetailFromEvents,

  // Legacy API adapters (for backward compatibility with existing UI)
  projectQuestList,
  projectQuestDetail
} from './read-model'
