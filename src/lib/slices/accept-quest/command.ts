// ============================================================================
// ACCEPT-QUEST SLICE - Command Handler
// ============================================================================
//
// This slice handles the ACCEPT_QUEST command, which is issued when a player
// accepts a quest from the quest hub. It validates the command and produces
// the appropriate events.
//
// PRODUCES EVENTS:
// - QUEST_ACCEPTED: The quest is now active
// - PHASE_CHANGED: Transition from quest_hub to narrative
// - DILEMMA_PRESENTED: First dilemma of the quest is shown
//
// BUSINESS RULES:
// - Game must be in progress
// - No active quest can exist
// - Quest must exist in content
// - Quest must have at least one dilemma
// ============================================================================

import type { GameEvent, QuestAcceptedEvent, PhaseChangedEvent, DilemmaPresenedEvent } from '../shared-kernel/events'
import { createTimestamp } from '../shared-kernel/types'

// Import quest content helpers
import { getQuestById, getQuestFirstDilemma } from '../../game/content/quests'

// ----------------------------------------------------------------------------
// Command Types
// ----------------------------------------------------------------------------

/**
 * Command to accept a quest from the quest hub.
 */
export interface AcceptQuestCommand {
  type: 'ACCEPT_QUEST'
  data: {
    questId: string
  }
}

/**
 * Minimal state needed to validate the accept quest command.
 * This slice only needs to know about quest-related state.
 */
export interface AcceptQuestState {
  gameStatus: 'not_started' | 'in_progress' | 'ended'
  activeQuest: { questId: string } | null
}

// ----------------------------------------------------------------------------
// Error Types
// ----------------------------------------------------------------------------

export class AcceptQuestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AcceptQuestError'
  }
}

// ----------------------------------------------------------------------------
// Command Handler
// ----------------------------------------------------------------------------

/**
 * Handle the ACCEPT_QUEST command.
 *
 * Validates that:
 * 1. Game is in progress
 * 2. No active quest exists
 * 3. Quest exists in content
 * 4. Quest has at least one dilemma
 *
 * @param command The accept quest command
 * @param state Current game state (minimal slice view)
 * @returns Array of events to emit
 * @throws AcceptQuestError if command is invalid
 */
export function handleAcceptQuest(
  command: AcceptQuestCommand,
  state: AcceptQuestState
): GameEvent[] {
  // Validate game is in progress
  if (state.gameStatus !== 'in_progress') {
    throw new AcceptQuestError('Game not in progress')
  }

  // Validate no active quest
  if (state.activeQuest) {
    throw new AcceptQuestError('Already have an active quest')
  }

  const { questId } = command.data

  // Look up quest from content
  const quest = getQuestById(questId)
  if (!quest) {
    throw new AcceptQuestError(`Quest not found: ${questId}`)
  }

  // Get the first dilemma for this quest
  const firstDilemma = getQuestFirstDilemma(questId)
  if (!firstDilemma) {
    throw new AcceptQuestError(`Quest has no dilemmas: ${questId}`)
  }

  const ts = createTimestamp()

  // Produce events
  const questAccepted: QuestAcceptedEvent = {
    type: 'QUEST_ACCEPTED',
    data: {
      timestamp: ts,
      questId,
      factionId: quest.faction,
      initialBounty: quest.initialBounty,
      initialCardIds: quest.initialCards
    }
  }

  const phaseChanged: PhaseChangedEvent = {
    type: 'PHASE_CHANGED',
    data: {
      timestamp: ts,
      fromPhase: 'quest_hub',
      toPhase: 'narrative'
    }
  }

  const dilemmaPresented: DilemmaPresenedEvent = {
    type: 'DILEMMA_PRESENTED',
    data: {
      timestamp: ts,
      dilemmaId: firstDilemma.id,
      questId
    }
  }

  return [questAccepted, phaseChanged, dilemmaPresented]
}

// ----------------------------------------------------------------------------
// Command Factory
// ----------------------------------------------------------------------------

/**
 * Create an ACCEPT_QUEST command.
 */
export function createAcceptQuestCommand(questId: string): AcceptQuestCommand {
  return {
    type: 'ACCEPT_QUEST',
    data: { questId }
  }
}
