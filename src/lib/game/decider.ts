import type { GameCommand, GameEvent, GameState } from './types'

export class InvalidCommandError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidCommandError'
  }
}

export function decide(command: GameCommand, state: GameState): GameEvent[] {
  switch (command.type) {
    case 'START_GAME':
      if (state.status !== 'not_started') {
        throw new InvalidCommandError('Game already started')
      }
      return [
        {
          type: 'GAME_STARTED',
          data: {
            playerId: command.data.playerId,
            startedAt: command.data.timestamp
          }
        },
        {
          type: 'LOCATION_ENTERED',
          data: {
            locationId: 'starting_room',
            enteredAt: command.data.timestamp
          }
        }
      ]

    case 'MAKE_CHOICE':
      if (state.status !== 'in_progress') {
        throw new InvalidCommandError('Game not in progress')
      }

      // Check if this choice was already made
      const alreadyMade = state.choicesMade.some(
        c => c.choiceId === command.data.choiceId
      )
      if (alreadyMade) {
        throw new InvalidCommandError('Choice already made')
      }

      const events: GameEvent[] = [
        {
          type: 'CHOICE_MADE',
          data: {
            choiceId: command.data.choiceId,
            option: command.data.option,
            madeAt: new Date().toISOString()
          }
        }
      ]

      // Apply moral alignment changes based on choice
      const alignmentDelta = calculateMoralDelta(command.data.choiceId, command.data.option)
      if (alignmentDelta !== 0) {
        events.push({
          type: 'MORAL_ALIGNMENT_CHANGED',
          data: {
            delta: alignmentDelta,
            newValue: state.moralAlignment + alignmentDelta
          }
        })
      }

      return events

    case 'ENTER_LOCATION':
      if (state.status !== 'in_progress') {
        throw new InvalidCommandError('Game not in progress')
      }
      return [
        {
          type: 'LOCATION_ENTERED',
          data: {
            locationId: command.data.locationId,
            enteredAt: new Date().toISOString()
          }
        }
      ]

    case 'COLLECT_ITEM':
      if (state.status !== 'in_progress') {
        throw new InvalidCommandError('Game not in progress')
      }
      if (state.inventory.includes(command.data.itemId)) {
        throw new InvalidCommandError('Item already collected')
      }
      return [
        {
          type: 'ITEM_COLLECTED',
          data: {
            itemId: command.data.itemId,
            collectedAt: new Date().toISOString()
          }
        }
      ]

    default:
      throw new InvalidCommandError(`Unknown command type: ${(command as GameCommand).type}`)
  }
}

// Business logic: map choices to moral alignment changes
function calculateMoralDelta(choiceId: string, option: string): number {
  const moralChoices: Record<string, Record<string, number>> = {
    moral_dilemma_1: {
      help: 25,
      ignore: -25
    },
    moral_dilemma_2: {
      honest: 15,
      lie: -15
    }
  }

  return moralChoices[choiceId]?.[option] ?? 0
}
