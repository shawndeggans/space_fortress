// ============================================================================
// CONSEQUENCE SLICE - Tests
// ============================================================================
//
// Tests for the consequence command handlers and read model.
// Uses Given-When-Then pattern.
// ============================================================================

import { describe, it, expect } from 'vitest'
import type { GameEvent } from '../../../game/events'
import {
  handleAcknowledgeOutcome,
  handleContinueToNextPhase,
  createAcknowledgeOutcomeCommand,
  createContinueToNextPhaseCommand,
  ConsequenceError,
  type ConsequenceState
} from '../command'
import {
  createConsequenceProjection,
  buildConsequenceStateView,
  projectConsequenceStateFromEvents
} from '../read-model'

// ----------------------------------------------------------------------------
// Test Helpers
// ----------------------------------------------------------------------------

function timestamp(): string {
  return new Date().toISOString()
}

function createConsequenceState(overrides: Partial<ConsequenceState> = {}): ConsequenceState {
  return {
    currentPhase: 'consequence',
    currentBattle: { battleId: 'battle-1' },
    hasAcknowledgedOutcome: false,
    currentDilemmaId: 'dilemma_salvage_1_approach',
    activeQuest: {
      questId: 'quest_salvage_claim',
      currentDilemmaIndex: 0,
      totalDilemmas: 3
    },
    ...overrides
  }
}

function createBattleResolvedEvent(
  battleId = 'battle-1',
  outcome: 'victory' | 'defeat' | 'draw' = 'victory'
): GameEvent {
  return {
    type: 'BATTLE_RESOLVED',
    data: {
      timestamp: timestamp(),
      battleId,
      outcome,
      playerWins: outcome === 'victory' ? 3 : 1,
      opponentWins: outcome === 'defeat' ? 3 : 1,
      draws: 1,
      roundsSummary: []
    }
  }
}

function createOutcomeAcknowledgedEvent(battleId = 'battle-1'): GameEvent {
  return {
    type: 'OUTCOME_ACKNOWLEDGED',
    data: {
      timestamp: timestamp(),
      battleId
    }
  }
}

function createQuestCompletedEvent(questId = 'quest-1'): GameEvent {
  return {
    type: 'QUEST_COMPLETED',
    data: {
      timestamp: timestamp(),
      questId,
      outcome: 'completed',
      finalBounty: 500
    }
  }
}

function createCompromiseAcceptedEvent(): GameEvent {
  return {
    type: 'COMPROMISE_ACCEPTED',
    data: {
      timestamp: timestamp(),
      terms: 'Diplomatic resolution',
      bountyModifier: 0.5
    }
  }
}

// ----------------------------------------------------------------------------
// Command Handler Tests
// ----------------------------------------------------------------------------

describe('Consequence Command Handlers', () => {
  describe('ACKNOWLEDGE_OUTCOME', () => {
    it('emits OUTCOME_ACKNOWLEDGED event when valid', () => {
      // Given: in consequence phase with a battle to acknowledge
      const state = createConsequenceState()
      const command = createAcknowledgeOutcomeCommand()

      // When: acknowledge outcome
      const events = handleAcknowledgeOutcome(command, state)

      // Then: OUTCOME_ACKNOWLEDGED emitted
      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('OUTCOME_ACKNOWLEDGED')
      expect((events[0].data as any).battleId).toBe('battle-1')
    })

    it('includes timestamp in event', () => {
      // Given: valid state
      const state = createConsequenceState()
      const command = createAcknowledgeOutcomeCommand()

      // When: acknowledge outcome
      const events = handleAcknowledgeOutcome(command, state)

      // Then: timestamp included
      expect(events[0].data.timestamp).toBeDefined()
    })

    it('rejects if not in consequence phase', () => {
      // Given: in battle phase
      const state = createConsequenceState({ currentPhase: 'battle' })
      const command = createAcknowledgeOutcomeCommand()

      // When/Then: error thrown
      expect(() => handleAcknowledgeOutcome(command, state))
        .toThrow(ConsequenceError)
      expect(() => handleAcknowledgeOutcome(command, state))
        .toThrow('Not in consequence phase')
    })

    it('rejects if no battle to acknowledge', () => {
      // Given: no current battle
      const state = createConsequenceState({ currentBattle: null })
      const command = createAcknowledgeOutcomeCommand()

      // When/Then: error thrown
      expect(() => handleAcknowledgeOutcome(command, state))
        .toThrow(ConsequenceError)
      expect(() => handleAcknowledgeOutcome(command, state))
        .toThrow('No battle to acknowledge')
    })

    it('uses battle ID from state', () => {
      // Given: specific battle ID
      const state = createConsequenceState({
        currentBattle: { battleId: 'epic-battle-42' }
      })
      const command = createAcknowledgeOutcomeCommand()

      // When: acknowledge outcome
      const events = handleAcknowledgeOutcome(command, state)

      // Then: correct battle ID in event
      expect((events[0].data as any).battleId).toBe('epic-battle-42')
    })
  })

  describe('CONTINUE_TO_NEXT_PHASE', () => {
    it('emits DILEMMA_PRESENTED and PHASE_CHANGED to narrative when more dilemmas remain', () => {
      // Given: quest with more dilemmas (using real quest ID so getNextDilemma works)
      const state = createConsequenceState({
        currentDilemmaId: 'dilemma_salvage_1_approach',
        activeQuest: {
          questId: 'quest_salvage_claim',
          currentDilemmaIndex: 0,
          totalDilemmas: 3
        }
      })
      const command = createContinueToNextPhaseCommand()

      // When: continue to next phase
      const events = handleContinueToNextPhase(command, state)

      // Then: DILEMMA_PRESENTED for next dilemma, then PHASE_CHANGED to narrative
      expect(events).toHaveLength(2)
      expect(events[0].type).toBe('DILEMMA_PRESENTED')
      expect((events[0].data as any).dilemmaId).toBe('dilemma_salvage_2_discovery')
      expect((events[0].data as any).questId).toBe('quest_salvage_claim')
      expect(events[1].type).toBe('PHASE_CHANGED')
      expect((events[1].data as any).fromPhase).toBe('consequence')
      expect((events[1].data as any).toPhase).toBe('narrative')
    })

    it('emits QUEST_SUMMARY_PRESENTED and PHASE_CHANGED to quest_summary when quest complete', () => {
      // Given: on last dilemma
      const state = createConsequenceState({
        activeQuest: {
          questId: 'quest-1',
          currentDilemmaIndex: 2,
          totalDilemmas: 3
        }
      })
      const command = createContinueToNextPhaseCommand()

      // When: continue to next phase
      const events = handleContinueToNextPhase(command, state)

      // Then: QUEST_SUMMARY_PRESENTED and PHASE_CHANGED emitted
      expect(events).toHaveLength(2)
      expect(events[0].type).toBe('QUEST_SUMMARY_PRESENTED')
      expect((events[0].data as any).questId).toBe('quest-1')
      expect(events[1].type).toBe('PHASE_CHANGED')
      expect((events[1].data as any).toPhase).toBe('quest_summary')
    })

    it('emits PHASE_CHANGED to quest_hub when no active quest', () => {
      // Given: no active quest
      const state = createConsequenceState({ activeQuest: null })
      const command = createContinueToNextPhaseCommand()

      // When: continue to next phase
      const events = handleContinueToNextPhase(command, state)

      // Then: PHASE_CHANGED to quest_hub
      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('PHASE_CHANGED')
      expect((events[0].data as any).toPhase).toBe('quest_hub')
    })

    it('rejects if not in consequence phase', () => {
      // Given: in narrative phase
      const state = createConsequenceState({ currentPhase: 'narrative' })
      const command = createContinueToNextPhaseCommand()

      // When/Then: error thrown
      expect(() => handleContinueToNextPhase(command, state))
        .toThrow(ConsequenceError)
      expect(() => handleContinueToNextPhase(command, state))
        .toThrow('Not in consequence phase')
    })

    it('handles mid-quest continuation correctly', () => {
      // Given: quest at dilemma 1 of 3
      const state = createConsequenceState({
        activeQuest: {
          questId: 'quest-1',
          currentDilemmaIndex: 1,
          totalDilemmas: 3
        }
      })
      const command = createContinueToNextPhaseCommand()

      // When: continue to next phase
      const events = handleContinueToNextPhase(command, state)

      // Then: goes to narrative (more dilemmas)
      expect(events).toHaveLength(1)
      expect((events[0].data as any).toPhase).toBe('narrative')
    })
  })
})

// ----------------------------------------------------------------------------
// Command Factory Tests
// ----------------------------------------------------------------------------

describe('Command Factories', () => {
  it('creates ACKNOWLEDGE_OUTCOME command', () => {
    const command = createAcknowledgeOutcomeCommand()
    expect(command.type).toBe('ACKNOWLEDGE_OUTCOME')
    expect(command.data).toEqual({})
  })

  it('creates CONTINUE_TO_NEXT_PHASE command', () => {
    const command = createContinueToNextPhaseCommand()
    expect(command.type).toBe('CONTINUE_TO_NEXT_PHASE')
    expect(command.data).toEqual({})
  })
})

// ----------------------------------------------------------------------------
// Read Model Tests
// ----------------------------------------------------------------------------

describe('Consequence Read Model', () => {
  describe('Projection', () => {
    it('returns initial state when no consequence events', () => {
      // Given: no events
      const events: GameEvent[] = []

      // When: projecting
      const view = projectConsequenceStateFromEvents(events)

      // Then: initial state
      expect(view.battleId).toBeNull()
      expect(view.outcome).toBeNull()
      expect(view.hasAcknowledged).toBe(false)
    })

    it('initializes from BATTLE_RESOLVED', () => {
      // Given: battle resolved
      const events: GameEvent[] = [
        createBattleResolvedEvent('battle-123', 'victory')
      ]

      // When: projecting
      const view = projectConsequenceStateFromEvents(events)

      // Then: initialized
      expect(view.battleId).toBe('battle-123')
      expect(view.outcome).toBe('victory')
      expect(view.hasAcknowledged).toBe(false)
    })

    it('tracks defeat outcome', () => {
      // Given: battle lost
      const events: GameEvent[] = [
        createBattleResolvedEvent('battle-1', 'defeat')
      ]

      // When: projecting
      const view = projectConsequenceStateFromEvents(events)

      // Then: defeat tracked
      expect(view.outcome).toBe('defeat')
    })

    it('tracks draw outcome', () => {
      // Given: battle draw
      const events: GameEvent[] = [
        createBattleResolvedEvent('battle-1', 'draw')
      ]

      // When: projecting
      const view = projectConsequenceStateFromEvents(events)

      // Then: draw tracked
      expect(view.outcome).toBe('draw')
    })

    it('tracks acknowledgement from OUTCOME_ACKNOWLEDGED', () => {
      // Given: outcome acknowledged
      const events: GameEvent[] = [
        createBattleResolvedEvent('battle-1'),
        createOutcomeAcknowledgedEvent('battle-1')
      ]

      // When: projecting
      const view = projectConsequenceStateFromEvents(events)

      // Then: acknowledged
      expect(view.hasAcknowledged).toBe(true)
      expect(view.isComplete).toBe(true)
    })

    it('ignores acknowledgement for different battle', () => {
      // Given: acknowledgement for different battle
      const events: GameEvent[] = [
        createBattleResolvedEvent('battle-1'),
        createOutcomeAcknowledgedEvent('battle-other')
      ]

      // When: projecting
      const view = projectConsequenceStateFromEvents(events)

      // Then: not acknowledged
      expect(view.hasAcknowledged).toBe(false)
    })

    it('tracks quest completion from QUEST_COMPLETED', () => {
      // Given: quest completed
      const events: GameEvent[] = [
        createBattleResolvedEvent(),
        createOutcomeAcknowledgedEvent(),
        createQuestCompletedEvent()
      ]

      // When: projecting
      const view = projectConsequenceStateFromEvents(events)

      // Then: quest complete
      expect(view.nextStep).toBe('quest_complete')
    })

    it('handles compromise resolution', () => {
      // Given: compromise accepted (from mediation)
      const events: GameEvent[] = [
        createCompromiseAcceptedEvent()
      ]

      // When: projecting
      const view = projectConsequenceStateFromEvents(events)

      // Then: counts as victory
      expect(view.outcome).toBe('victory')
    })
  })

  describe('View Builder', () => {
    it('calculates nextStep correctly', () => {
      const { initialState, reducer } = createConsequenceProjection()

      // Unknown when not acknowledged
      let state = reducer(initialState, createBattleResolvedEvent())
      let view = buildConsequenceStateView(state)
      expect(view.nextStep).toBe('unknown')

      // Continue quest when acknowledged but not complete
      state = reducer(state, createOutcomeAcknowledgedEvent())
      view = buildConsequenceStateView(state)
      expect(view.nextStep).toBe('continue_quest')

      // Quest complete when quest completed
      state = reducer(state, createQuestCompletedEvent())
      view = buildConsequenceStateView(state)
      expect(view.nextStep).toBe('quest_complete')
    })

    it('calculates isComplete correctly', () => {
      const { initialState, reducer } = createConsequenceProjection()

      // Not complete initially
      let state = reducer(initialState, createBattleResolvedEvent())
      let view = buildConsequenceStateView(state)
      expect(view.isComplete).toBe(false)

      // Complete after acknowledgement
      state = reducer(state, createOutcomeAcknowledgedEvent())
      view = buildConsequenceStateView(state)
      expect(view.isComplete).toBe(true)
    })
  })

  describe('Full Consequence Flow', () => {
    it('projects victory flow with quest continuation', () => {
      // Given: battle won, acknowledged
      const events: GameEvent[] = [
        createBattleResolvedEvent('battle-1', 'victory'),
        createOutcomeAcknowledgedEvent('battle-1')
      ]

      // When: projecting
      const view = projectConsequenceStateFromEvents(events)

      // Then: shows continue state
      expect(view.battleId).toBe('battle-1')
      expect(view.outcome).toBe('victory')
      expect(view.hasAcknowledged).toBe(true)
      expect(view.isComplete).toBe(true)
      expect(view.nextStep).toBe('continue_quest')
    })

    it('projects defeat flow', () => {
      // Given: battle lost, acknowledged
      const events: GameEvent[] = [
        createBattleResolvedEvent('battle-1', 'defeat'),
        createOutcomeAcknowledgedEvent('battle-1')
      ]

      // When: projecting
      const view = projectConsequenceStateFromEvents(events)

      // Then: shows defeat
      expect(view.outcome).toBe('defeat')
      expect(view.hasAcknowledged).toBe(true)
    })

    it('projects quest completion flow', () => {
      // Given: final battle won, quest complete
      const events: GameEvent[] = [
        createBattleResolvedEvent('battle-final', 'victory'),
        createOutcomeAcknowledgedEvent('battle-final'),
        createQuestCompletedEvent('quest-1')
      ]

      // When: projecting
      const view = projectConsequenceStateFromEvents(events)

      // Then: shows quest complete
      expect(view.outcome).toBe('victory')
      expect(view.hasAcknowledged).toBe(true)
      expect(view.nextStep).toBe('quest_complete')
    })

    it('projects compromise flow', () => {
      // Given: mediation compromise
      const events: GameEvent[] = [
        createCompromiseAcceptedEvent(),
        createOutcomeAcknowledgedEvent('battle-1')
      ]

      // When: projecting
      const view = projectConsequenceStateFromEvents(events)

      // Then: shows victory (compromise counts as win)
      expect(view.outcome).toBe('victory')
    })
  })
})
