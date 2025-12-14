import type { GameState, GameEvent } from './types'

export function getInitialState(): GameState {
  return {
    playerId: '',
    currentLocation: 'unknown',
    moralAlignment: 0,
    choicesMade: [],
    inventory: [],
    status: 'not_started'
  }
}

export function evolveState(state: GameState, event: GameEvent): GameState {
  switch (event.type) {
    case 'GAME_STARTED':
      return {
        ...state,
        playerId: event.data.playerId,
        currentLocation: 'starting_room',
        status: 'in_progress'
      }

    case 'LOCATION_ENTERED':
      return {
        ...state,
        currentLocation: event.data.locationId
      }

    case 'CHOICE_MADE':
      return {
        ...state,
        choicesMade: [
          ...state.choicesMade,
          { choiceId: event.data.choiceId, option: event.data.option }
        ]
      }

    case 'MORAL_ALIGNMENT_CHANGED':
      return {
        ...state,
        moralAlignment: event.data.newValue
      }

    case 'ITEM_COLLECTED':
      return {
        ...state,
        inventory: [...state.inventory, event.data.itemId]
      }

    default:
      return state
  }
}

export function rebuildState(events: GameEvent[]): GameState {
  return events.reduce(evolveState, getInitialState())
}
