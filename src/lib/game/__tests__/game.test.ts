import { describe, it, expect } from 'vitest'
import { evolveState, getInitialState, rebuildState } from '../projections'
import { decide, InvalidCommandError } from '../decider'
import type { GameEvent, GameCommand, GameState } from '../types'

describe('Event Projections', () => {
  it('returns initial state correctly', () => {
    const state = getInitialState()
    expect(state.status).toBe('not_started')
    expect(state.moralAlignment).toBe(0)
    expect(state.choicesMade).toEqual([])
    expect(state.inventory).toEqual([])
  })

  it('handles GAME_STARTED event', () => {
    const state = getInitialState()
    const event: GameEvent = {
      type: 'GAME_STARTED',
      data: { playerId: 'player-1', startedAt: '2024-01-01T00:00:00Z' }
    }
    const newState = evolveState(state, event)
    expect(newState.playerId).toBe('player-1')
    expect(newState.status).toBe('in_progress')
    expect(newState.currentLocation).toBe('starting_room')
  })

  it('handles CHOICE_MADE event', () => {
    const state: GameState = {
      ...getInitialState(),
      status: 'in_progress'
    }
    const event: GameEvent = {
      type: 'CHOICE_MADE',
      data: { choiceId: 'choice-1', option: 'help', madeAt: '2024-01-01T00:00:00Z' }
    }
    const newState = evolveState(state, event)
    expect(newState.choicesMade).toHaveLength(1)
    expect(newState.choicesMade[0]).toEqual({ choiceId: 'choice-1', option: 'help' })
  })

  it('handles MORAL_ALIGNMENT_CHANGED event', () => {
    const state: GameState = {
      ...getInitialState(),
      moralAlignment: 0
    }
    const event: GameEvent = {
      type: 'MORAL_ALIGNMENT_CHANGED',
      data: { delta: 25, newValue: 25 }
    }
    const newState = evolveState(state, event)
    expect(newState.moralAlignment).toBe(25)
  })

  it('rebuilds identical state from events', () => {
    const events: GameEvent[] = [
      { type: 'GAME_STARTED', data: { playerId: 'player-1', startedAt: '2024-01-01T00:00:00Z' } },
      { type: 'LOCATION_ENTERED', data: { locationId: 'starting_room', enteredAt: '2024-01-01T00:00:00Z' } },
      { type: 'CHOICE_MADE', data: { choiceId: 'moral_dilemma_1', option: 'help', madeAt: '2024-01-01T00:00:01Z' } },
      { type: 'MORAL_ALIGNMENT_CHANGED', data: { delta: 25, newValue: 25 } }
    ]

    const state1 = rebuildState(events)
    const state2 = rebuildState(events)

    expect(state1).toEqual(state2)
    expect(state1.moralAlignment).toBe(25)
    expect(state1.choicesMade).toHaveLength(1)
  })

  it('handles events in batches', () => {
    const events: GameEvent[] = [
      { type: 'GAME_STARTED', data: { playerId: 'player-1', startedAt: '2024-01-01' } },
      { type: 'CHOICE_MADE', data: { choiceId: 'a', option: 'help', madeAt: '2024-01-01' } },
      { type: 'MORAL_ALIGNMENT_CHANGED', data: { delta: 25, newValue: 25 } },
      { type: 'CHOICE_MADE', data: { choiceId: 'b', option: 'honest', madeAt: '2024-01-01' } },
      { type: 'MORAL_ALIGNMENT_CHANGED', data: { delta: 15, newValue: 40 } }
    ]

    // Process all at once
    const stateAll = rebuildState(events)

    // Process in batches of 2
    let stateBatched = getInitialState()
    for (let i = 0; i < events.length; i += 2) {
      const batch = events.slice(i, i + 2)
      stateBatched = batch.reduce(evolveState, stateBatched)
    }

    expect(stateAll.moralAlignment).toBe(stateBatched.moralAlignment)
    expect(stateAll.choicesMade).toEqual(stateBatched.choicesMade)
  })
})

describe('Decider', () => {
  it('generates GAME_STARTED events from START_GAME command', () => {
    const state = getInitialState()
    const command: GameCommand = {
      type: 'START_GAME',
      data: { playerId: 'player-1', timestamp: '2024-01-01T00:00:00Z' }
    }
    const events = decide(command, state)
    expect(events).toHaveLength(2) // GAME_STARTED + LOCATION_ENTERED
    expect(events[0].type).toBe('GAME_STARTED')
    expect(events[1].type).toBe('LOCATION_ENTERED')
  })

  it('throws error if game already started', () => {
    const state: GameState = {
      ...getInitialState(),
      status: 'in_progress'
    }
    const command: GameCommand = {
      type: 'START_GAME',
      data: { playerId: 'player-1', timestamp: '2024-01-01T00:00:00Z' }
    }
    expect(() => decide(command, state)).toThrow(InvalidCommandError)
  })

  it('generates events from MAKE_CHOICE command with moral alignment', () => {
    const state: GameState = {
      ...getInitialState(),
      status: 'in_progress',
      moralAlignment: 0
    }
    const command: GameCommand = {
      type: 'MAKE_CHOICE',
      data: { choiceId: 'moral_dilemma_1', option: 'help' }
    }
    const events = decide(command, state)
    expect(events).toHaveLength(2)
    expect(events[0].type).toBe('CHOICE_MADE')
    expect(events[1].type).toBe('MORAL_ALIGNMENT_CHANGED')
    expect((events[1] as any).data.delta).toBe(25)
  })

  it('generates negative alignment for ignore choice', () => {
    const state: GameState = {
      ...getInitialState(),
      status: 'in_progress',
      moralAlignment: 0
    }
    const command: GameCommand = {
      type: 'MAKE_CHOICE',
      data: { choiceId: 'moral_dilemma_1', option: 'ignore' }
    }
    const events = decide(command, state)
    expect(events).toHaveLength(2)
    expect((events[1] as any).data.delta).toBe(-25)
  })

  it('throws error if choice already made', () => {
    const state: GameState = {
      ...getInitialState(),
      status: 'in_progress',
      choicesMade: [{ choiceId: 'moral_dilemma_1', option: 'help' }]
    }
    const command: GameCommand = {
      type: 'MAKE_CHOICE',
      data: { choiceId: 'moral_dilemma_1', option: 'ignore' }
    }
    expect(() => decide(command, state)).toThrow(InvalidCommandError)
  })

  it('handles item collection', () => {
    const state: GameState = {
      ...getInitialState(),
      status: 'in_progress'
    }
    const command: GameCommand = {
      type: 'COLLECT_ITEM',
      data: { itemId: 'key-1' }
    }
    const events = decide(command, state)
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('ITEM_COLLECTED')
    expect((events[0] as any).data.itemId).toBe('key-1')
  })
})
