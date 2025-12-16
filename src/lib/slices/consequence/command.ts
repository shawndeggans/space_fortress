// ============================================================================
// CONSEQUENCE SLICE - Command Handlers
// ============================================================================
//
// Handles consequence phase after battle or mediation:
// - ACKNOWLEDGE_OUTCOME: Player acknowledges battle/mediation outcome
// - CONTINUE_TO_NEXT_PHASE: Player continues to next phase
//
// Business Rules:
// - Must be in consequence phase
// - Must have a current battle to acknowledge
// - Next phase determined by quest progress
// ============================================================================

import type { GameEvent } from '../../game/events'
import type { GamePhase } from '../../game/types'
import { getNextDilemma } from '../../game/content/quests'

// ----------------------------------------------------------------------------
// Error Class
// ----------------------------------------------------------------------------

export class ConsequenceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConsequenceError'
  }
}

// ----------------------------------------------------------------------------
// Command Types
// ----------------------------------------------------------------------------

export interface AcknowledgeOutcomeCommand {
  type: 'ACKNOWLEDGE_OUTCOME'
  data: Record<string, never>
}

export interface ContinueToNextPhaseCommand {
  type: 'CONTINUE_TO_NEXT_PHASE'
  data: Record<string, never>
}

export type ConsequenceCommand =
  | AcknowledgeOutcomeCommand
  | ContinueToNextPhaseCommand

// ----------------------------------------------------------------------------
// State Required by Handlers
// ----------------------------------------------------------------------------

export interface ConsequenceState {
  currentPhase: GamePhase
  currentBattle: {
    battleId: string
  } | null
  hasAcknowledgedOutcome: boolean
  // Current dilemma for looking up next
  currentDilemmaId: string | null
  // For determining next phase
  activeQuest: {
    questId: string
    currentDilemmaIndex: number
    totalDilemmas: number
  } | null
}

// ----------------------------------------------------------------------------
// Helper
// ----------------------------------------------------------------------------

function timestamp(): string {
  return new Date().toISOString()
}

// ----------------------------------------------------------------------------
// Command Factories
// ----------------------------------------------------------------------------

export function createAcknowledgeOutcomeCommand(): AcknowledgeOutcomeCommand {
  return { type: 'ACKNOWLEDGE_OUTCOME', data: {} }
}

export function createContinueToNextPhaseCommand(): ContinueToNextPhaseCommand {
  return { type: 'CONTINUE_TO_NEXT_PHASE', data: {} }
}

// ----------------------------------------------------------------------------
// ACKNOWLEDGE_OUTCOME Handler
// ----------------------------------------------------------------------------

export function handleAcknowledgeOutcome(
  command: AcknowledgeOutcomeCommand,
  state: ConsequenceState
): GameEvent[] {
  // Validate phase
  if (state.currentPhase !== 'consequence') {
    throw new ConsequenceError('Not in consequence phase')
  }

  // Validate battle exists
  if (!state.currentBattle) {
    throw new ConsequenceError('No battle to acknowledge')
  }

  return [
    {
      type: 'OUTCOME_ACKNOWLEDGED',
      data: {
        timestamp: timestamp(),
        battleId: state.currentBattle.battleId
      }
    }
  ]
}

// ----------------------------------------------------------------------------
// CONTINUE_TO_NEXT_PHASE Handler
// ----------------------------------------------------------------------------

export function handleContinueToNextPhase(
  command: ContinueToNextPhaseCommand,
  state: ConsequenceState
): GameEvent[] {
  // Validate phase - can be consequence or other phases that allow continuation
  if (state.currentPhase !== 'consequence') {
    throw new ConsequenceError('Not in consequence phase')
  }

  const ts = timestamp()
  const events: GameEvent[] = []

  // Determine next phase based on quest progress
  let toPhase: GamePhase = 'narrative'

  if (state.activeQuest) {
    const { currentDilemmaIndex, totalDilemmas } = state.activeQuest

    if (currentDilemmaIndex >= totalDilemmas - 1) {
      // Quest complete - go to quest summary instead of quest hub
      toPhase = 'quest_summary'
      events.push({
        type: 'QUEST_SUMMARY_PRESENTED',
        data: {
          timestamp: ts,
          questId: state.activeQuest.questId,
          questTitle: state.activeQuest.questId, // Title would be looked up
          outcome: 'completed'
        }
      })
    } else {
      // More dilemmas - go to narrative
      toPhase = 'narrative'

      // Look up and emit the next dilemma
      if (state.currentDilemmaId) {
        const nextDilemma = getNextDilemma(state.activeQuest.questId, state.currentDilemmaId)
        if (nextDilemma) {
          events.push({
            type: 'DILEMMA_PRESENTED',
            data: {
              timestamp: ts,
              dilemmaId: nextDilemma.id,
              questId: state.activeQuest.questId
            }
          })
        }
      }
    }
  } else {
    // No active quest - go to quest hub
    toPhase = 'quest_hub'
  }

  events.push({
    type: 'PHASE_CHANGED',
    data: {
      timestamp: ts,
      fromPhase: 'consequence',
      toPhase
    }
  })

  return events
}
