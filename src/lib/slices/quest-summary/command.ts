// ============================================================================
// QUEST-SUMMARY SLICE - Command Handlers
// ============================================================================
//
// Handles the quest summary phase at the end of a quest:
// - ACKNOWLEDGE_QUEST_SUMMARY: Player acknowledges and returns to quest hub
//
// Business Rules:
// - Must be in quest_summary phase
// - Must have completed the active quest
// - On acknowledge: emit QUEST_COMPLETED and return to quest_hub
// ============================================================================

import type { GameEvent } from '../../game/events'
import type { GamePhase, FactionId } from '../../game/types'

// ----------------------------------------------------------------------------
// Error Class
// ----------------------------------------------------------------------------

export class QuestSummaryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QuestSummaryError'
  }
}

// ----------------------------------------------------------------------------
// Command Types
// ----------------------------------------------------------------------------

export interface AcknowledgeQuestSummaryCommand {
  type: 'ACKNOWLEDGE_QUEST_SUMMARY'
  data: Record<string, never>
}

export type QuestSummaryCommand = AcknowledgeQuestSummaryCommand

// ----------------------------------------------------------------------------
// State Required by Handlers
// ----------------------------------------------------------------------------

export interface QuestSummaryState {
  currentPhase: GamePhase
  activeQuest: {
    questId: string
    factionId: FactionId
  } | null
  bounty: number
}

// ----------------------------------------------------------------------------
// Helper
// ----------------------------------------------------------------------------

function timestamp(): string {
  return new Date().toISOString()
}

// ----------------------------------------------------------------------------
// Command Factory
// ----------------------------------------------------------------------------

export function createAcknowledgeQuestSummaryCommand(): AcknowledgeQuestSummaryCommand {
  return { type: 'ACKNOWLEDGE_QUEST_SUMMARY', data: {} }
}

// ----------------------------------------------------------------------------
// ACKNOWLEDGE_QUEST_SUMMARY Handler
// ----------------------------------------------------------------------------

export function handleAcknowledgeQuestSummary(
  command: AcknowledgeQuestSummaryCommand,
  state: QuestSummaryState
): GameEvent[] {
  const ts = timestamp()
  const events: GameEvent[] = []

  // Validate phase
  if (state.currentPhase !== 'quest_summary') {
    throw new QuestSummaryError('Not in quest summary phase')
  }

  if (!state.activeQuest) {
    throw new QuestSummaryError('No active quest to summarize')
  }

  // Emit acknowledgment event
  events.push({
    type: 'QUEST_SUMMARY_ACKNOWLEDGED',
    data: {
      timestamp: ts,
      questId: state.activeQuest.questId
    }
  })

  // Emit quest completed event
  events.push({
    type: 'QUEST_COMPLETED',
    data: {
      timestamp: ts,
      questId: state.activeQuest.questId,
      outcome: 'completed',
      finalBounty: state.bounty
    }
  })

  // Transition to quest hub
  events.push({
    type: 'PHASE_CHANGED',
    data: {
      timestamp: ts,
      fromPhase: 'quest_summary',
      toPhase: 'quest_hub'
    }
  })

  return events
}
