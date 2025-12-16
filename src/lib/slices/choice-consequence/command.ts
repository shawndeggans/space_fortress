// ============================================================================
// CHOICE-CONSEQUENCE SLICE - Command Handlers
// ============================================================================
//
// Handles the choice consequence phase after a narrative choice:
// - ACKNOWLEDGE_CHOICE_CONSEQUENCE: Player acknowledges and continues
//
// Business Rules:
// - Must be in choice_consequence phase
// - Next phase determined by choice triggers and quest progress
// ============================================================================

import type { GameEvent } from '../../game/events'
import type { GamePhase, FactionId } from '../../game/types'
import { getNextDilemma, getQuestById } from '../../game/content/quests'

// ----------------------------------------------------------------------------
// Error Class
// ----------------------------------------------------------------------------

export class ChoiceConsequenceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChoiceConsequenceError'
  }
}

// ----------------------------------------------------------------------------
// Command Types
// ----------------------------------------------------------------------------

export interface AcknowledgeChoiceConsequenceCommand {
  type: 'ACKNOWLEDGE_CHOICE_CONSEQUENCE'
  data: Record<string, never>
}

export type ChoiceConsequenceCommand = AcknowledgeChoiceConsequenceCommand

// ----------------------------------------------------------------------------
// State Required by Handlers
// ----------------------------------------------------------------------------

export interface ChoiceConsequenceState {
  currentPhase: GamePhase
  activeQuest: {
    questId: string
    currentDilemmaIndex: number
    totalDilemmas: number
  } | null
  currentDilemmaId: string | null
  lastChoiceId: string | null
  // What the choice triggers (stored from CHOICE_CONSEQUENCE_PRESENTED event)
  choiceTriggersNext: 'dilemma' | 'battle' | 'alliance' | 'mediation' | 'quest_complete' | null
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

export function createAcknowledgeChoiceConsequenceCommand(): AcknowledgeChoiceConsequenceCommand {
  return { type: 'ACKNOWLEDGE_CHOICE_CONSEQUENCE', data: {} }
}

// ----------------------------------------------------------------------------
// ACKNOWLEDGE_CHOICE_CONSEQUENCE Handler
// ----------------------------------------------------------------------------

export function handleAcknowledgeChoiceConsequence(
  command: AcknowledgeChoiceConsequenceCommand,
  state: ChoiceConsequenceState
): GameEvent[] {
  const ts = timestamp()
  const events: GameEvent[] = []

  // Validate phase
  if (state.currentPhase !== 'choice_consequence') {
    throw new ChoiceConsequenceError('Not in choice consequence phase')
  }

  if (!state.activeQuest) {
    throw new ChoiceConsequenceError('No active quest')
  }

  // Emit acknowledgment event
  events.push({
    type: 'CHOICE_CONSEQUENCE_ACKNOWLEDGED',
    data: {
      timestamp: ts,
      dilemmaId: state.currentDilemmaId || '',
      choiceId: state.lastChoiceId || ''
    }
  })

  // Determine next phase based on what the choice triggers
  const triggersNext = state.choiceTriggersNext

  if (triggersNext === 'battle' || triggersNext === 'alliance') {
    // Go to alliance phase (alliance comes before battle)
    events.push({
      type: 'PHASE_CHANGED',
      data: {
        timestamp: ts,
        fromPhase: 'choice_consequence',
        toPhase: 'alliance'
      }
    })
  } else if (triggersNext === 'mediation') {
    // Go to mediation phase
    events.push({
      type: 'PHASE_CHANGED',
      data: {
        timestamp: ts,
        fromPhase: 'choice_consequence',
        toPhase: 'mediation'
      }
    })
  } else if (triggersNext === 'quest_complete') {
    // Go to quest summary
    const quest = getQuestById(state.activeQuest.questId)
    events.push({
      type: 'QUEST_SUMMARY_PRESENTED',
      data: {
        timestamp: ts,
        questId: state.activeQuest.questId,
        questTitle: quest?.title || state.activeQuest.questId,
        outcome: 'completed'
      }
    })
    events.push({
      type: 'PHASE_CHANGED',
      data: {
        timestamp: ts,
        fromPhase: 'choice_consequence',
        toPhase: 'quest_summary'
      }
    })
  } else {
    // Default: go to next dilemma (narrative phase)
    const nextDilemma = state.currentDilemmaId
      ? getNextDilemma(state.activeQuest.questId, state.currentDilemmaId)
      : null

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

    events.push({
      type: 'PHASE_CHANGED',
      data: {
        timestamp: ts,
        fromPhase: 'choice_consequence',
        toPhase: 'narrative'
      }
    })
  }

  return events
}
