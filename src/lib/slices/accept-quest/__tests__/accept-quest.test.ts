// ============================================================================
// ACCEPT-QUEST SLICE - Tests
// ============================================================================
//
// Given-When-Then tests for the accept-quest slice following the
// specifications in SLICE-01-ACCEPT-QUEST.md
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest'
import {
  handleAcceptQuest,
  createAcceptQuestCommand,
  AcceptQuestError,
  type AcceptQuestState,
  createQuestListProjection,
  buildQuestListView,
  buildQuestDetailView,
  projectQuestListFromEvents,
  projectQuestDetailFromEvents
} from '../index'
import type { GameEvent } from '../../shared-kernel'
import { createTimestamp } from '../../shared-kernel'

// ----------------------------------------------------------------------------
// Test Fixtures
// ----------------------------------------------------------------------------

function createGameStartedState(): AcceptQuestState {
  return {
    gameStatus: 'in_progress',
    activeQuest: null
  }
}

function createStateWithActiveQuest(): AcceptQuestState {
  return {
    gameStatus: 'in_progress',
    activeQuest: { questId: 'some_quest' }
  }
}

function createNotStartedState(): AcceptQuestState {
  return {
    gameStatus: 'not_started',
    activeQuest: null
  }
}

// ----------------------------------------------------------------------------
// Command Handler Tests
// ----------------------------------------------------------------------------

describe('Accept Quest Command Handler', () => {
  describe('Spec 1: Accept Available Quest', () => {
    it('should emit QUEST_ACCEPTED, PHASE_CHANGED, and DILEMMA_PRESENTED events', () => {
      // Given: Player on quest hub with no active quest
      const state = createGameStartedState()

      // When: Player accepts a quest
      const command = createAcceptQuestCommand('quest_salvage_claim')
      const events = handleAcceptQuest(command, state)

      // Then: Three events are emitted in correct order
      expect(events).toHaveLength(3)

      // QUEST_ACCEPTED event
      expect(events[0].type).toBe('QUEST_ACCEPTED')
      expect(events[0].data).toMatchObject({
        questId: 'quest_salvage_claim',
        factionId: 'ironveil'
      })

      // PHASE_CHANGED event
      expect(events[1].type).toBe('PHASE_CHANGED')
      expect(events[1].data).toMatchObject({
        fromPhase: 'quest_hub',
        toPhase: 'narrative'
      })

      // DILEMMA_PRESENTED event
      expect(events[2].type).toBe('DILEMMA_PRESENTED')
      expect(events[2].data).toMatchObject({
        questId: 'quest_salvage_claim'
      })
    })

    it('should include initial bounty and cards in QUEST_ACCEPTED', () => {
      const state = createGameStartedState()
      const command = createAcceptQuestCommand('quest_salvage_claim')

      const events = handleAcceptQuest(command, state)

      const questAccepted = events[0]
      expect(questAccepted.type).toBe('QUEST_ACCEPTED')
      expect((questAccepted as any).data.initialBounty).toBeGreaterThan(0)
      expect((questAccepted as any).data.initialCardIds).toBeDefined()
    })
  })

  describe('Spec 2: Reject When Active Quest Exists', () => {
    it('should throw error when player already has an active quest', () => {
      // Given: Player has an active quest
      const state = createStateWithActiveQuest()

      // When/Then: Attempting to accept another quest throws
      const command = createAcceptQuestCommand('quest_salvage_claim')

      expect(() => handleAcceptQuest(command, state)).toThrow(AcceptQuestError)
      expect(() => handleAcceptQuest(command, state)).toThrow('Already have an active quest')
    })
  })

  describe('Spec 3: Reject When Game Not Started', () => {
    it('should throw error when game is not in progress', () => {
      // Given: Game has not started
      const state = createNotStartedState()

      // When/Then: Attempting to accept quest throws
      const command = createAcceptQuestCommand('quest_salvage_claim')

      expect(() => handleAcceptQuest(command, state)).toThrow(AcceptQuestError)
      expect(() => handleAcceptQuest(command, state)).toThrow('Game not in progress')
    })
  })

  describe('Spec 4: Reject Unknown Quest', () => {
    it('should throw error when quest does not exist', () => {
      // Given: Player on quest hub
      const state = createGameStartedState()

      // When/Then: Attempting to accept non-existent quest throws
      const command = createAcceptQuestCommand('quest_does_not_exist')

      expect(() => handleAcceptQuest(command, state)).toThrow(AcceptQuestError)
      expect(() => handleAcceptQuest(command, state)).toThrow('Quest not found')
    })
  })
})

// ----------------------------------------------------------------------------
// Read Model Tests
// ----------------------------------------------------------------------------

describe('Accept Quest Read Model', () => {
  describe('Quest List Projection', () => {
    it('should start with all quests available', () => {
      const events: GameEvent[] = [
        {
          type: 'GAME_STARTED',
          data: {
            timestamp: createTimestamp(),
            playerId: 'player-1',
            starterCardIds: ['card-1']
          }
        }
      ]

      const view = projectQuestListFromEvents(events)

      // Should have quests (some available, some may be locked by rep)
      expect(view.available.length + view.locked.length).toBeGreaterThan(0)
      expect(view.hasActiveQuest).toBe(false)
      expect(view.activeQuestId).toBeNull()
      expect(view.completed).toHaveLength(0)
    })

    it('should mark quest as active after acceptance', () => {
      const events: GameEvent[] = [
        {
          type: 'GAME_STARTED',
          data: {
            timestamp: createTimestamp(),
            playerId: 'player-1',
            starterCardIds: ['card-1']
          }
        },
        {
          type: 'QUEST_ACCEPTED',
          data: {
            timestamp: createTimestamp(),
            questId: 'quest_salvage_claim',
            factionId: 'ironveil',
            initialBounty: 500,
            initialCardIds: []
          }
        }
      ]

      const view = projectQuestListFromEvents(events)

      expect(view.hasActiveQuest).toBe(true)
      expect(view.activeQuestId).toBe('quest_salvage_claim')
      // Accepted quest should not be in available list
      expect(view.available.find(q => q.questId === 'quest_salvage_claim')).toBeUndefined()
    })

    it('should move quest to completed after completion', () => {
      const events: GameEvent[] = [
        {
          type: 'GAME_STARTED',
          data: {
            timestamp: createTimestamp(),
            playerId: 'player-1',
            starterCardIds: ['card-1']
          }
        },
        {
          type: 'QUEST_ACCEPTED',
          data: {
            timestamp: createTimestamp(),
            questId: 'quest_salvage_claim',
            factionId: 'ironveil',
            initialBounty: 500,
            initialCardIds: []
          }
        },
        {
          type: 'QUEST_COMPLETED',
          data: {
            timestamp: createTimestamp(),
            questId: 'quest_salvage_claim',
            outcome: 'full',
            finalBounty: 500
          }
        }
      ]

      const view = projectQuestListFromEvents(events)

      expect(view.hasActiveQuest).toBe(false)
      expect(view.activeQuestId).toBeNull()
      expect(view.completed).toHaveLength(1)
      expect(view.completed[0]).toMatchObject({
        questId: 'quest_salvage_claim',
        outcome: 'full',
        finalBounty: 500
      })
    })

    it('should update unlock status based on reputation changes', () => {
      // Start with events that give high reputation to a faction
      const events: GameEvent[] = [
        {
          type: 'GAME_STARTED',
          data: {
            timestamp: createTimestamp(),
            playerId: 'player-1',
            starterCardIds: ['card-1']
          }
        },
        {
          type: 'REPUTATION_CHANGED',
          data: {
            timestamp: createTimestamp(),
            factionId: 'ironveil',
            delta: 50,
            newValue: 50,
            source: 'choice'
          }
        }
      ]

      const view = projectQuestListFromEvents(events)

      // Find quests for ironveil
      const ironveilQuests = view.available.filter(q => q.factionId === 'ironveil')
      // With 50 rep, quests requiring <= 50 should be unlocked
      ironveilQuests.forEach(q => {
        if (q.reputationRequired <= 50) {
          expect(q.isUnlocked).toBe(true)
        }
      })
    })
  })

  describe('Quest Detail Projection', () => {
    it('should return null for unknown quest', () => {
      const events: GameEvent[] = [
        {
          type: 'GAME_STARTED',
          data: {
            timestamp: createTimestamp(),
            playerId: 'player-1',
            starterCardIds: ['card-1']
          }
        }
      ]

      const view = projectQuestDetailFromEvents(events, 'quest_does_not_exist')

      expect(view).toBeNull()
    })

    it('should show canAccept true when requirements met', () => {
      const events: GameEvent[] = [
        {
          type: 'GAME_STARTED',
          data: {
            timestamp: createTimestamp(),
            playerId: 'player-1',
            starterCardIds: ['card-1']
          }
        }
      ]

      // quest_salvage_claim requires 0 reputation, so it should be acceptable
      const view = projectQuestDetailFromEvents(events, 'quest_salvage_claim')

      expect(view).not.toBeNull()
      expect(view!.canAccept).toBe(true)
      expect(view!.cantAcceptReason).toBeUndefined()
    })

    it('should show canAccept false when already have active quest', () => {
      const events: GameEvent[] = [
        {
          type: 'GAME_STARTED',
          data: {
            timestamp: createTimestamp(),
            playerId: 'player-1',
            starterCardIds: ['card-1']
          }
        },
        {
          type: 'QUEST_ACCEPTED',
          data: {
            timestamp: createTimestamp(),
            questId: 'quest_sanctuary_run',
            factionId: 'ashfall',
            initialBounty: 400,
            initialCardIds: []
          }
        }
      ]

      // Try to view details of a different quest
      const view = projectQuestDetailFromEvents(events, 'quest_salvage_claim')

      expect(view).not.toBeNull()
      expect(view!.canAccept).toBe(false)
      expect(view!.cantAcceptReason).toContain('active quest')
    })

    it('should include quest metadata', () => {
      const events: GameEvent[] = [
        {
          type: 'GAME_STARTED',
          data: {
            timestamp: createTimestamp(),
            playerId: 'player-1',
            starterCardIds: ['card-1']
          }
        }
      ]

      const view = projectQuestDetailFromEvents(events, 'quest_salvage_claim')

      expect(view).not.toBeNull()
      expect(view!.questId).toBe('quest_salvage_claim')
      expect(view!.title).toBeDefined()
      expect(view!.fullDescription).toBeDefined()
      expect(view!.factionId).toBe('ironveil')
      expect(view!.factionName).toBeDefined()
      expect(view!.questGiverName).toBeDefined()
      expect(view!.initialBounty).toBeGreaterThan(0)
    })
  })

  describe('Projection with Event Bus', () => {
    it('should build state reactively with event bus subscription', () => {
      const projection = createQuestListProjection()

      // Manually rebuild from events
      projection.rebuildFrom([
        {
          type: 'GAME_STARTED',
          data: {
            timestamp: createTimestamp(),
            playerId: 'player-1',
            starterCardIds: ['card-1']
          }
        }
      ])

      const state = projection.getState()
      const view = buildQuestListView(state)

      expect(view.hasActiveQuest).toBe(false)
      expect(view.available.length + view.locked.length).toBeGreaterThan(0)
    })

    it('should reset to initial state', () => {
      const projection = createQuestListProjection()

      projection.rebuildFrom([
        {
          type: 'GAME_STARTED',
          data: {
            timestamp: createTimestamp(),
            playerId: 'player-1',
            starterCardIds: ['card-1']
          }
        },
        {
          type: 'QUEST_ACCEPTED',
          data: {
            timestamp: createTimestamp(),
            questId: 'quest_salvage_claim',
            factionId: 'ironveil',
            initialBounty: 500,
            initialCardIds: []
          }
        }
      ])

      let view = buildQuestListView(projection.getState())
      expect(view.hasActiveQuest).toBe(true)

      projection.reset()

      view = buildQuestListView(projection.getState())
      expect(view.hasActiveQuest).toBe(false)
    })
  })
})

// ----------------------------------------------------------------------------
// Integration Tests
// ----------------------------------------------------------------------------

describe('Accept Quest Integration', () => {
  it('should produce events that update read model correctly', () => {
    // Start with initial state
    const commandState = createGameStartedState()
    const command = createAcceptQuestCommand('quest_salvage_claim')

    // Execute command
    const producedEvents = handleAcceptQuest(command, commandState)

    // Feed events to projection
    const allEvents: GameEvent[] = [
      {
        type: 'GAME_STARTED',
        data: {
          timestamp: createTimestamp(),
          playerId: 'player-1',
          starterCardIds: ['card-1']
        }
      },
      ...producedEvents
    ]

    const view = projectQuestListFromEvents(allEvents)

    // Verify read model reflects the command result
    expect(view.hasActiveQuest).toBe(true)
    expect(view.activeQuestId).toBe('quest_salvage_claim')
    expect(view.available.find(q => q.questId === 'quest_salvage_claim')).toBeUndefined()
  })
})
