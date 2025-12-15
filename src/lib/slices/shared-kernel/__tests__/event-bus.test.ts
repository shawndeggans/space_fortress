// ============================================================================
// SHARED KERNEL - Event Bus Tests
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createEventBus,
  createProjection,
  getGlobalEventBus,
  resetGlobalEventBus
} from '../event-bus'
import type { GameEvent, QuestAcceptedEvent, CardGainedEvent } from '../events'
import { createTimestamp } from '../types'

describe('Event Bus', () => {
  describe('createEventBus', () => {
    it('should dispatch events to type-specific subscribers', () => {
      const bus = createEventBus()
      const handler = vi.fn()

      bus.subscribe('QUEST_ACCEPTED', handler)

      const event: QuestAcceptedEvent = {
        type: 'QUEST_ACCEPTED',
        data: {
          timestamp: createTimestamp(),
          questId: 'quest-1',
          factionId: 'ironveil',
          initialBounty: 500,
          initialCardIds: ['card-1']
        }
      }

      bus.dispatch(event)

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(event)
    })

    it('should not call handler for different event types', () => {
      const bus = createEventBus()
      const questHandler = vi.fn()

      bus.subscribe('QUEST_ACCEPTED', questHandler)

      const event: CardGainedEvent = {
        type: 'CARD_GAINED',
        data: {
          timestamp: createTimestamp(),
          cardId: 'card-1',
          factionId: 'ironveil',
          source: 'quest'
        }
      }

      bus.dispatch(event)

      expect(questHandler).not.toHaveBeenCalled()
    })

    it('should support subscribeAll for receiving all events', () => {
      const bus = createEventBus()
      const allHandler = vi.fn()

      bus.subscribeAll(allHandler)

      const questEvent: QuestAcceptedEvent = {
        type: 'QUEST_ACCEPTED',
        data: {
          timestamp: createTimestamp(),
          questId: 'quest-1',
          factionId: 'ironveil',
          initialBounty: 500,
          initialCardIds: []
        }
      }

      const cardEvent: CardGainedEvent = {
        type: 'CARD_GAINED',
        data: {
          timestamp: createTimestamp(),
          cardId: 'card-1',
          factionId: 'ironveil',
          source: 'quest'
        }
      }

      bus.dispatch(questEvent)
      bus.dispatch(cardEvent)

      expect(allHandler).toHaveBeenCalledTimes(2)
      expect(allHandler).toHaveBeenNthCalledWith(1, questEvent)
      expect(allHandler).toHaveBeenNthCalledWith(2, cardEvent)
    })

    it('should allow unsubscribing', () => {
      const bus = createEventBus()
      const handler = vi.fn()

      const unsubscribe = bus.subscribe('QUEST_ACCEPTED', handler)

      const event: QuestAcceptedEvent = {
        type: 'QUEST_ACCEPTED',
        data: {
          timestamp: createTimestamp(),
          questId: 'quest-1',
          factionId: 'ironveil',
          initialBounty: 500,
          initialCardIds: []
        }
      }

      bus.dispatch(event)
      expect(handler).toHaveBeenCalledTimes(1)

      unsubscribe()

      bus.dispatch(event)
      expect(handler).toHaveBeenCalledTimes(1) // Still 1, not called again
    })

    it('should support multiple subscribers for same event type', () => {
      const bus = createEventBus()
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      bus.subscribe('QUEST_ACCEPTED', handler1)
      bus.subscribe('QUEST_ACCEPTED', handler2)

      const event: QuestAcceptedEvent = {
        type: 'QUEST_ACCEPTED',
        data: {
          timestamp: createTimestamp(),
          questId: 'quest-1',
          factionId: 'ironveil',
          initialBounty: 500,
          initialCardIds: []
        }
      }

      bus.dispatch(event)

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
    })

    it('should dispatch multiple events in order with dispatchMany', () => {
      const bus = createEventBus()
      const allHandler = vi.fn()
      bus.subscribeAll(allHandler)

      const events: GameEvent[] = [
        {
          type: 'QUEST_ACCEPTED',
          data: {
            timestamp: createTimestamp(),
            questId: 'quest-1',
            factionId: 'ironveil',
            initialBounty: 500,
            initialCardIds: []
          }
        },
        {
          type: 'CARD_GAINED',
          data: {
            timestamp: createTimestamp(),
            cardId: 'card-1',
            factionId: 'ironveil',
            source: 'quest'
          }
        }
      ]

      bus.dispatchMany(events)

      expect(allHandler).toHaveBeenCalledTimes(2)
      expect(allHandler).toHaveBeenNthCalledWith(1, events[0])
      expect(allHandler).toHaveBeenNthCalledWith(2, events[1])
    })
  })

  describe('Event History', () => {
    it('should store events in history when enabled', () => {
      const bus = createEventBus({ enableHistory: true })

      const event: QuestAcceptedEvent = {
        type: 'QUEST_ACCEPTED',
        data: {
          timestamp: createTimestamp(),
          questId: 'quest-1',
          factionId: 'ironveil',
          initialBounty: 500,
          initialCardIds: []
        }
      }

      bus.dispatch(event)

      const history = bus.getHistory()
      expect(history).toHaveLength(1)
      expect(history[0]).toEqual(event)
    })

    it('should not store events when history is disabled', () => {
      const bus = createEventBus({ enableHistory: false })

      const event: QuestAcceptedEvent = {
        type: 'QUEST_ACCEPTED',
        data: {
          timestamp: createTimestamp(),
          questId: 'quest-1',
          factionId: 'ironveil',
          initialBounty: 500,
          initialCardIds: []
        }
      }

      bus.dispatch(event)

      const history = bus.getHistory()
      expect(history).toHaveLength(0)
    })

    it('should limit history size to maxHistorySize', () => {
      const bus = createEventBus({ enableHistory: true, maxHistorySize: 2 })

      for (let i = 0; i < 5; i++) {
        bus.dispatch({
          type: 'QUEST_VIEWED',
          data: {
            timestamp: createTimestamp(),
            questId: `quest-${i}`
          }
        })
      }

      const history = bus.getHistory()
      expect(history).toHaveLength(2)
      // Should have the last 2 events
      expect((history[0] as any).data.questId).toBe('quest-3')
      expect((history[1] as any).data.questId).toBe('quest-4')
    })

    it('should replay history to a handler', () => {
      const bus = createEventBus({ enableHistory: true })
      const handler = vi.fn()

      bus.dispatch({
        type: 'QUEST_ACCEPTED',
        data: {
          timestamp: createTimestamp(),
          questId: 'quest-1',
          factionId: 'ironveil',
          initialBounty: 500,
          initialCardIds: []
        }
      })

      bus.dispatch({
        type: 'CARD_GAINED',
        data: {
          timestamp: createTimestamp(),
          cardId: 'card-1',
          factionId: 'ironveil',
          source: 'quest'
        }
      })

      bus.replay(handler)

      expect(handler).toHaveBeenCalledTimes(2)
    })

    it('should clear history', () => {
      const bus = createEventBus({ enableHistory: true })

      bus.dispatch({
        type: 'QUEST_ACCEPTED',
        data: {
          timestamp: createTimestamp(),
          questId: 'quest-1',
          factionId: 'ironveil',
          initialBounty: 500,
          initialCardIds: []
        }
      })

      expect(bus.getHistory()).toHaveLength(1)

      bus.clearHistory()

      expect(bus.getHistory()).toHaveLength(0)
    })
  })

  describe('Error Handling', () => {
    it('should call onError callback when handler throws', () => {
      const onError = vi.fn()
      const bus = createEventBus({ onError })

      bus.subscribe('QUEST_ACCEPTED', () => {
        throw new Error('Handler error')
      })

      const event: QuestAcceptedEvent = {
        type: 'QUEST_ACCEPTED',
        data: {
          timestamp: createTimestamp(),
          questId: 'quest-1',
          factionId: 'ironveil',
          initialBounty: 500,
          initialCardIds: []
        }
      }

      bus.dispatch(event)

      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError).toHaveBeenCalledWith(expect.any(Error), event)
    })

    it('should continue dispatching to other handlers when one throws', () => {
      const bus = createEventBus({ onError: vi.fn() })
      const handler1 = vi.fn(() => {
        throw new Error('Handler 1 error')
      })
      const handler2 = vi.fn()

      bus.subscribe('QUEST_ACCEPTED', handler1)
      bus.subscribe('QUEST_ACCEPTED', handler2)

      const event: QuestAcceptedEvent = {
        type: 'QUEST_ACCEPTED',
        data: {
          timestamp: createTimestamp(),
          questId: 'quest-1',
          factionId: 'ironveil',
          initialBounty: 500,
          initialCardIds: []
        }
      }

      bus.dispatch(event)

      expect(handler1).toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
    })
  })

  describe('Callbacks', () => {
    it('should call onDispatch callback for every event', () => {
      const onDispatch = vi.fn()
      const bus = createEventBus({ onDispatch })

      const event: QuestAcceptedEvent = {
        type: 'QUEST_ACCEPTED',
        data: {
          timestamp: createTimestamp(),
          questId: 'quest-1',
          factionId: 'ironveil',
          initialBounty: 500,
          initialCardIds: []
        }
      }

      bus.dispatch(event)

      expect(onDispatch).toHaveBeenCalledTimes(1)
      expect(onDispatch).toHaveBeenCalledWith(event)
    })
  })
})

describe('createProjection', () => {
  interface TestState {
    questIds: string[]
    cardCount: number
  }

  const initialState: TestState = {
    questIds: [],
    cardCount: 0
  }

  const reducer = (state: TestState, event: GameEvent): TestState => {
    switch (event.type) {
      case 'QUEST_ACCEPTED':
        return {
          ...state,
          questIds: [...state.questIds, event.data.questId]
        }
      case 'CARD_GAINED':
        return {
          ...state,
          cardCount: state.cardCount + 1
        }
      default:
        return state
    }
  }

  it('should build state from events', () => {
    const bus = createEventBus({ enableHistory: true })
    const projection = createProjection(initialState, reducer)

    projection.subscribe(bus)

    bus.dispatch({
      type: 'QUEST_ACCEPTED',
      data: {
        timestamp: createTimestamp(),
        questId: 'quest-1',
        factionId: 'ironveil',
        initialBounty: 500,
        initialCardIds: []
      }
    })

    bus.dispatch({
      type: 'CARD_GAINED',
      data: {
        timestamp: createTimestamp(),
        cardId: 'card-1',
        factionId: 'ironveil',
        source: 'quest'
      }
    })

    const state = projection.getState()
    expect(state.questIds).toEqual(['quest-1'])
    expect(state.cardCount).toBe(1)
  })

  it('should replay history when subscribing', () => {
    const bus = createEventBus({ enableHistory: true })

    // Dispatch events before subscription
    bus.dispatch({
      type: 'QUEST_ACCEPTED',
      data: {
        timestamp: createTimestamp(),
        questId: 'quest-1',
        factionId: 'ironveil',
        initialBounty: 500,
        initialCardIds: []
      }
    })

    // Subscribe after events
    const projection = createProjection(initialState, reducer)
    projection.subscribe(bus)

    // Should have replayed the event
    expect(projection.getState().questIds).toEqual(['quest-1'])
  })

  it('should reset state to initial', () => {
    const projection = createProjection(initialState, reducer)

    projection.rebuildFrom([
      {
        type: 'QUEST_ACCEPTED',
        data: {
          timestamp: createTimestamp(),
          questId: 'quest-1',
          factionId: 'ironveil',
          initialBounty: 500,
          initialCardIds: []
        }
      }
    ])

    expect(projection.getState().questIds).toEqual(['quest-1'])

    projection.reset()

    expect(projection.getState()).toEqual(initialState)
  })

  it('should rebuild from event array', () => {
    const projection = createProjection(initialState, reducer)

    const events: GameEvent[] = [
      {
        type: 'QUEST_ACCEPTED',
        data: {
          timestamp: createTimestamp(),
          questId: 'quest-1',
          factionId: 'ironveil',
          initialBounty: 500,
          initialCardIds: []
        }
      },
      {
        type: 'CARD_GAINED',
        data: {
          timestamp: createTimestamp(),
          cardId: 'card-1',
          factionId: 'ironveil',
          source: 'quest'
        }
      },
      {
        type: 'CARD_GAINED',
        data: {
          timestamp: createTimestamp(),
          cardId: 'card-2',
          factionId: 'ashfall',
          source: 'alliance'
        }
      }
    ]

    projection.rebuildFrom(events)

    const state = projection.getState()
    expect(state.questIds).toEqual(['quest-1'])
    expect(state.cardCount).toBe(2)
  })
})

describe('Global Event Bus', () => {
  beforeEach(() => {
    resetGlobalEventBus()
  })

  it('should return the same instance on multiple calls', () => {
    const bus1 = getGlobalEventBus()
    const bus2 = getGlobalEventBus()

    expect(bus1).toBe(bus2)
  })

  it('should create new instance after reset', () => {
    const bus1 = getGlobalEventBus()
    resetGlobalEventBus()
    const bus2 = getGlobalEventBus()

    expect(bus1).not.toBe(bus2)
  })

  it('should have history enabled by default', () => {
    const bus = getGlobalEventBus()

    bus.dispatch({
      type: 'QUEST_ACCEPTED',
      data: {
        timestamp: createTimestamp(),
        questId: 'quest-1',
        factionId: 'ironveil',
        initialBounty: 500,
        initialCardIds: []
      }
    })

    expect(bus.getHistory()).toHaveLength(1)
  })
})
