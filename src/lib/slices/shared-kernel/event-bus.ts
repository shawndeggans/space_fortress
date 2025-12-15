// ============================================================================
// SHARED KERNEL - Event Bus
// ============================================================================
//
// The event bus provides infrastructure for event dispatch and subscription.
// It enables loose coupling between slices - producers emit events without
// knowing who consumes them, and consumers subscribe without knowing
// who produces them.
//
// ARCHITECTURE:
// - Events are dispatched through the bus
// - Subscribers receive events they're interested in
// - The bus can optionally persist events to storage
// - Events are immutable and ordered
//
// USAGE:
// 1. Slices dispatch events when commands are processed
// 2. Other slices subscribe to events they need for projections
// 3. UI subscribes to projection updates
// ============================================================================

import type { GameEvent, GameEventType } from './events'

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

/**
 * A function that handles events of a specific type.
 */
export type EventHandler<E extends GameEvent = GameEvent> = (event: E) => void

/**
 * A function to unsubscribe from events.
 */
export type Unsubscribe = () => void

/**
 * Event bus configuration options.
 */
export interface EventBusOptions {
  /** If true, events will be stored in memory for replay */
  enableHistory?: boolean
  /** Maximum number of events to keep in history */
  maxHistorySize?: number
  /** Called when an event is dispatched */
  onDispatch?: (event: GameEvent) => void
  /** Called when an error occurs in a handler */
  onError?: (error: Error, event: GameEvent) => void
}

// ----------------------------------------------------------------------------
// Event Bus Implementation
// ----------------------------------------------------------------------------

/**
 * Creates an event bus for dispatching and subscribing to game events.
 *
 * The event bus is the central communication mechanism in the event-sourced
 * architecture. Slices use it to:
 * 1. Dispatch events when commands are processed
 * 2. Subscribe to events for building read models
 *
 * @example
 * ```typescript
 * const bus = createEventBus()
 *
 * // Subscribe to specific event types
 * bus.subscribe('QUEST_ACCEPTED', (event) => {
 *   console.log('Quest accepted:', event.data.questId)
 * })
 *
 * // Subscribe to all events
 * bus.subscribeAll((event) => {
 *   console.log('Event:', event.type)
 * })
 *
 * // Dispatch an event
 * bus.dispatch({
 *   type: 'QUEST_ACCEPTED',
 *   data: { timestamp: '...', questId: 'q1', ... }
 * })
 * ```
 */
export function createEventBus(options: EventBusOptions = {}) {
  const {
    enableHistory = false,
    maxHistorySize = 10000,
    onDispatch,
    onError
  } = options

  // Type-specific subscribers: Map<EventType, Set<Handler>>
  const subscribers = new Map<GameEventType, Set<EventHandler>>()

  // Subscribers that receive all events
  const allSubscribers = new Set<EventHandler>()

  // Event history (if enabled)
  const history: GameEvent[] = []

  /**
   * Subscribe to events of a specific type.
   */
  function subscribe<T extends GameEventType>(
    eventType: T,
    handler: EventHandler<Extract<GameEvent, { type: T }>>
  ): Unsubscribe {
    if (!subscribers.has(eventType)) {
      subscribers.set(eventType, new Set())
    }
    subscribers.get(eventType)!.add(handler as EventHandler)

    return () => {
      subscribers.get(eventType)?.delete(handler as EventHandler)
    }
  }

  /**
   * Subscribe to all events.
   */
  function subscribeAll(handler: EventHandler): Unsubscribe {
    allSubscribers.add(handler)
    return () => {
      allSubscribers.delete(handler)
    }
  }

  /**
   * Subscribe to multiple event types with a single handler.
   */
  function subscribeMany(
    eventTypes: GameEventType[],
    handler: EventHandler
  ): Unsubscribe {
    const unsubscribers = eventTypes.map(type => subscribe(type, handler))
    return () => {
      unsubscribers.forEach(unsub => unsub())
    }
  }

  /**
   * Dispatch a single event to all subscribers.
   */
  function dispatch(event: GameEvent): void {
    // Call global callback if provided
    onDispatch?.(event)

    // Store in history if enabled
    if (enableHistory) {
      history.push(event)
      // Trim history if it exceeds max size
      if (history.length > maxHistorySize) {
        history.shift()
      }
    }

    // Notify type-specific subscribers
    const typeSubscribers = subscribers.get(event.type)
    if (typeSubscribers) {
      Array.from(typeSubscribers).forEach(handler => {
        try {
          handler(event)
        } catch (error) {
          if (onError) {
            onError(error as Error, event)
          } else {
            console.error(`Error in event handler for ${event.type}:`, error)
          }
        }
      })
    }

    // Notify all-event subscribers
    Array.from(allSubscribers).forEach(handler => {
      try {
        handler(event)
      } catch (error) {
        if (onError) {
          onError(error as Error, event)
        } else {
          console.error(`Error in all-event handler for ${event.type}:`, error)
        }
      }
    })
  }

  /**
   * Dispatch multiple events in order.
   */
  function dispatchMany(events: GameEvent[]): void {
    for (const event of events) {
      dispatch(event)
    }
  }

  /**
   * Get the event history (only if enableHistory was true).
   */
  function getHistory(): readonly GameEvent[] {
    return history
  }

  /**
   * Clear the event history.
   */
  function clearHistory(): void {
    history.length = 0
  }

  /**
   * Replay all events from history to a handler.
   * Useful for rebuilding state from stored events.
   */
  function replay(handler: EventHandler): void {
    for (const event of history) {
      handler(event)
    }
  }

  /**
   * Remove all subscribers (useful for cleanup/testing).
   */
  function clear(): void {
    subscribers.clear()
    allSubscribers.clear()
  }

  return {
    subscribe,
    subscribeAll,
    subscribeMany,
    dispatch,
    dispatchMany,
    getHistory,
    clearHistory,
    replay,
    clear
  }
}

// ----------------------------------------------------------------------------
// Event Bus Type
// ----------------------------------------------------------------------------

export type EventBus = ReturnType<typeof createEventBus>

// ----------------------------------------------------------------------------
// Global Event Bus Instance
// ----------------------------------------------------------------------------

/**
 * The global event bus instance.
 * In most cases, you should use this shared instance rather than creating
 * your own. This ensures all slices communicate through the same bus.
 *
 * For testing, you can create isolated buses using createEventBus().
 */
let globalBus: EventBus | null = null

export function getGlobalEventBus(): EventBus {
  if (!globalBus) {
    globalBus = createEventBus({
      enableHistory: true,
      onError: (error, event) => {
        console.error(`Event bus error processing ${event.type}:`, error)
      }
    })
  }
  return globalBus
}

/**
 * Reset the global event bus (primarily for testing).
 */
export function resetGlobalEventBus(): void {
  if (globalBus) {
    globalBus.clear()
    globalBus.clearHistory()
  }
  globalBus = null
}

// ----------------------------------------------------------------------------
// Projection Builder Helper
// ----------------------------------------------------------------------------

/**
 * Creates a projection that builds state from events.
 *
 * A projection is a read model that is built by folding events.
 * This helper creates a projection with automatic subscription
 * and state management.
 *
 * @example
 * ```typescript
 * const questListProjection = createProjection(
 *   { available: [], completed: [] },
 *   (state, event) => {
 *     switch (event.type) {
 *       case 'QUEST_ACCEPTED':
 *         return { ...state, available: state.available.filter(q => q !== event.data.questId) }
 *       case 'QUEST_COMPLETED':
 *         return { ...state, completed: [...state.completed, event.data.questId] }
 *       default:
 *         return state
 *     }
 *   }
 * )
 *
 * // Start building from events
 * questListProjection.subscribe(getGlobalEventBus())
 *
 * // Get current state
 * const state = questListProjection.getState()
 * ```
 */
export function createProjection<S>(
  initialState: S,
  reducer: (state: S, event: GameEvent) => S
) {
  let state = initialState
  let unsubscribe: Unsubscribe | null = null

  return {
    /**
     * Subscribe to an event bus and start building state.
     */
    subscribe(bus: EventBus): Unsubscribe {
      // First, replay any existing history
      bus.replay((event) => {
        state = reducer(state, event)
      })

      // Then subscribe to new events
      unsubscribe = bus.subscribeAll((event) => {
        state = reducer(state, event)
      })

      return () => {
        unsubscribe?.()
        unsubscribe = null
      }
    },

    /**
     * Get the current projected state.
     */
    getState(): S {
      return state
    },

    /**
     * Reset state to initial value.
     */
    reset(): void {
      state = initialState
    },

    /**
     * Rebuild state from an array of events.
     */
    rebuildFrom(events: GameEvent[]): void {
      state = events.reduce(reducer, initialState)
    }
  }
}

export type Projection<S> = ReturnType<typeof createProjection<S>>
