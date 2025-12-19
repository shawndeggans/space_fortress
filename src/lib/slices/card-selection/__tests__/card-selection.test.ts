// ============================================================================
// CARD-SELECTION SLICE - Tests
// ============================================================================
//
// Tests for card selection command handlers and read model projections.
// Follows Given-When-Then specification pattern.
// ============================================================================

import { describe, it, expect } from 'vitest'
import type { GameEvent } from '../../../game/events'
import type { FactionId, OwnedCard } from '../../../game/types'
import {
  handleSelectCard,
  handleDeselectCard,
  handleCommitFleet,
  createSelectCardCommand,
  createDeselectCardCommand,
  createCommitFleetCommand,
  CardSelectionError,
  MAX_FLEET_SIZE,
  type CardSelectionState
} from '../command'
import {
  createCardSelectionProjection,
  buildCardPoolView,
  projectCardPoolFromEvents
} from '../read-model'

// ----------------------------------------------------------------------------
// Test Fixtures
// ----------------------------------------------------------------------------

function createOwnedCard(id: string, faction: FactionId, isLocked = false): OwnedCard {
  return {
    id,
    name: `Test Card ${id}`,
    faction,
    attack: 10,
    defense: 8,
    hull: 5,
    agility: 6,
    energyCost: 2,
    abilities: [],
    source: 'quest',
    acquiredAt: new Date().toISOString(),
    isLocked,
    lockReason: isLocked ? 'Battle damage' : undefined
  }
}

function createCardSelectionState(overrides: Partial<CardSelectionState> = {}): CardSelectionState {
  return {
    gameStatus: 'in_progress',
    currentPhase: 'card_selection',
    ownedCards: [
      createOwnedCard('card_1', 'ironveil'),
      createOwnedCard('card_2', 'ironveil'),
      createOwnedCard('card_3', 'ashfall'),
      createOwnedCard('card_4', 'ashfall'),
      createOwnedCard('card_5', 'meridian'),
      createOwnedCard('card_6', 'meridian'),
      createOwnedCard('card_7', 'void_wardens')
    ],
    currentBattle: {
      battleId: 'battle_001',
      selectedCardIds: []
    },
    ...overrides
  }
}

// ----------------------------------------------------------------------------
// SELECT_CARD Command Handler Tests
// ----------------------------------------------------------------------------

describe('SELECT_CARD Command Handler', () => {
  describe('Given player in card_selection phase with active battle', () => {
    it('When SELECT_CARD with valid unselected card, Then CARD_SELECTED event emitted', () => {
      // Given
      const state = createCardSelectionState()
      const command = createSelectCardCommand('card_1')

      // When
      const events = handleSelectCard(command, state)

      // Then
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        type: 'CARD_SELECTED',
        data: {
          cardId: 'card_1',
          battleId: 'battle_001'
        }
      })
    })

    it('When SELECT_CARD with already selected card, Then CardSelectionError thrown', () => {
      // Given
      const state = createCardSelectionState({
        currentBattle: {
          battleId: 'battle_001',
          selectedCardIds: ['card_1']
        }
      })
      const command = createSelectCardCommand('card_1')

      // When/Then
      expect(() => handleSelectCard(command, state)).toThrow(CardSelectionError)
      expect(() => handleSelectCard(command, state)).toThrow('Card already selected')
    })

    it('When SELECT_CARD at max capacity (5 cards), Then CardSelectionError thrown', () => {
      // Given
      const state = createCardSelectionState({
        currentBattle: {
          battleId: 'battle_001',
          selectedCardIds: ['card_1', 'card_2', 'card_3', 'card_4', 'card_5']
        }
      })
      const command = createSelectCardCommand('card_6')

      // When/Then
      expect(() => handleSelectCard(command, state)).toThrow(CardSelectionError)
      expect(() => handleSelectCard(command, state)).toThrow('Already selected 5 cards')
    })

    it('When SELECT_CARD with unowned card, Then CardSelectionError thrown', () => {
      // Given
      const state = createCardSelectionState()
      const command = createSelectCardCommand('card_nonexistent')

      // When/Then
      expect(() => handleSelectCard(command, state)).toThrow(CardSelectionError)
      expect(() => handleSelectCard(command, state)).toThrow('Card not owned')
    })

    it('When SELECT_CARD with locked card, Then CardSelectionError thrown', () => {
      // Given
      const lockedCard = createOwnedCard('card_locked', 'ironveil', true)
      const state = createCardSelectionState({
        ownedCards: [...createCardSelectionState().ownedCards, lockedCard]
      })
      const command = createSelectCardCommand('card_locked')

      // When/Then
      expect(() => handleSelectCard(command, state)).toThrow(CardSelectionError)
      expect(() => handleSelectCard(command, state)).toThrow('Card is locked')
    })
  })

  describe('Given player NOT in card_selection phase', () => {
    it('When SELECT_CARD, Then CardSelectionError thrown', () => {
      // Given
      const state = createCardSelectionState({ currentPhase: 'narrative' })
      const command = createSelectCardCommand('card_1')

      // When/Then
      expect(() => handleSelectCard(command, state)).toThrow(CardSelectionError)
      expect(() => handleSelectCard(command, state)).toThrow('Not in card selection phase')
    })
  })

  describe('Given player with no active battle', () => {
    it('When SELECT_CARD, Then CardSelectionError thrown', () => {
      // Given
      const state = createCardSelectionState({ currentBattle: null })
      const command = createSelectCardCommand('card_1')

      // When/Then
      expect(() => handleSelectCard(command, state)).toThrow(CardSelectionError)
      expect(() => handleSelectCard(command, state)).toThrow('No active battle')
    })
  })
})

// ----------------------------------------------------------------------------
// DESELECT_CARD Command Handler Tests
// ----------------------------------------------------------------------------

describe('DESELECT_CARD Command Handler', () => {
  describe('Given player with selected cards in battle', () => {
    it('When DESELECT_CARD with selected card, Then CARD_DESELECTED event emitted', () => {
      // Given
      const state = createCardSelectionState({
        currentBattle: {
          battleId: 'battle_001',
          selectedCardIds: ['card_1', 'card_2']
        }
      })
      const command = createDeselectCardCommand('card_1')

      // When
      const events = handleDeselectCard(command, state)

      // Then
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        type: 'CARD_DESELECTED',
        data: {
          cardId: 'card_1',
          battleId: 'battle_001'
        }
      })
    })

    it('When DESELECT_CARD with unselected card, Then CardSelectionError thrown', () => {
      // Given
      const state = createCardSelectionState({
        currentBattle: {
          battleId: 'battle_001',
          selectedCardIds: ['card_1']
        }
      })
      const command = createDeselectCardCommand('card_2')

      // When/Then
      expect(() => handleDeselectCard(command, state)).toThrow(CardSelectionError)
      expect(() => handleDeselectCard(command, state)).toThrow('Card not selected')
    })
  })

  describe('Given player NOT in card_selection phase', () => {
    it('When DESELECT_CARD, Then CardSelectionError thrown', () => {
      // Given
      const state = createCardSelectionState({
        currentPhase: 'deployment',
        currentBattle: {
          battleId: 'battle_001',
          selectedCardIds: ['card_1']
        }
      })
      const command = createDeselectCardCommand('card_1')

      // When/Then
      expect(() => handleDeselectCard(command, state)).toThrow(CardSelectionError)
      expect(() => handleDeselectCard(command, state)).toThrow('Not in card selection phase')
    })
  })

  describe('Given player with no active battle', () => {
    it('When DESELECT_CARD, Then CardSelectionError thrown', () => {
      // Given
      const state = createCardSelectionState({ currentBattle: null })
      const command = createDeselectCardCommand('card_1')

      // When/Then
      expect(() => handleDeselectCard(command, state)).toThrow(CardSelectionError)
      expect(() => handleDeselectCard(command, state)).toThrow('No active battle')
    })
  })
})

// ----------------------------------------------------------------------------
// COMMIT_FLEET Command Handler Tests
// ----------------------------------------------------------------------------

describe('COMMIT_FLEET Command Handler', () => {
  describe('Given player with 5 cards selected', () => {
    it('When COMMIT_FLEET with valid cards, Then FLEET_COMMITTED and PHASE_CHANGED events emitted', () => {
      // Given
      const state = createCardSelectionState({
        currentBattle: {
          battleId: 'battle_001',
          selectedCardIds: ['card_1', 'card_2', 'card_3', 'card_4', 'card_5']
        }
      })
      const command = createCommitFleetCommand(['card_1', 'card_2', 'card_3', 'card_4', 'card_5'])

      // When
      const events = handleCommitFleet(command, state)

      // Then
      expect(events).toHaveLength(2)
      expect(events[0]).toMatchObject({
        type: 'FLEET_COMMITTED',
        data: {
          battleId: 'battle_001',
          cardIds: ['card_1', 'card_2', 'card_3', 'card_4', 'card_5']
        }
      })
      expect(events[1]).toMatchObject({
        type: 'PHASE_CHANGED',
        data: {
          fromPhase: 'card_selection',
          toPhase: 'deployment'
        }
      })
    })
  })

  describe('Given player with fewer than 5 cards', () => {
    it('When COMMIT_FLEET with 4 cards, Then CardSelectionError thrown', () => {
      // Given
      const state = createCardSelectionState()
      const command = createCommitFleetCommand(['card_1', 'card_2', 'card_3', 'card_4'])

      // When/Then
      expect(() => handleCommitFleet(command, state)).toThrow(CardSelectionError)
      expect(() => handleCommitFleet(command, state)).toThrow('Must select exactly 5 cards')
    })

    it('When COMMIT_FLEET with 6 cards, Then CardSelectionError thrown', () => {
      // Given
      const state = createCardSelectionState()
      const command = createCommitFleetCommand(['card_1', 'card_2', 'card_3', 'card_4', 'card_5', 'card_6'])

      // When/Then
      expect(() => handleCommitFleet(command, state)).toThrow(CardSelectionError)
      expect(() => handleCommitFleet(command, state)).toThrow('Must select exactly 5 cards')
    })
  })

  describe('Given player with locked cards', () => {
    it('When COMMIT_FLEET includes locked card, Then CardSelectionError thrown', () => {
      // Given
      const lockedCard = createOwnedCard('card_locked', 'ironveil', true)
      const state = createCardSelectionState({
        ownedCards: [...createCardSelectionState().ownedCards, lockedCard]
      })
      const command = createCommitFleetCommand(['card_1', 'card_2', 'card_3', 'card_4', 'card_locked'])

      // When/Then
      expect(() => handleCommitFleet(command, state)).toThrow(CardSelectionError)
      expect(() => handleCommitFleet(command, state)).toThrow('Card is locked: card_locked')
    })
  })

  describe('Given player with unowned cards', () => {
    it('When COMMIT_FLEET includes unowned card, Then CardSelectionError thrown', () => {
      // Given
      const state = createCardSelectionState()
      const command = createCommitFleetCommand(['card_1', 'card_2', 'card_3', 'card_4', 'card_nonexistent'])

      // When/Then
      expect(() => handleCommitFleet(command, state)).toThrow(CardSelectionError)
      expect(() => handleCommitFleet(command, state)).toThrow('Card not owned: card_nonexistent')
    })
  })

  describe('Given player NOT in card_selection phase', () => {
    it('When COMMIT_FLEET, Then CardSelectionError thrown', () => {
      // Given
      const state = createCardSelectionState({ currentPhase: 'narrative' })
      const command = createCommitFleetCommand(['card_1', 'card_2', 'card_3', 'card_4', 'card_5'])

      // When/Then
      expect(() => handleCommitFleet(command, state)).toThrow(CardSelectionError)
      expect(() => handleCommitFleet(command, state)).toThrow('Not in card selection phase')
    })
  })

  describe('Given player with no active battle', () => {
    it('When COMMIT_FLEET, Then CardSelectionError thrown', () => {
      // Given
      const state = createCardSelectionState({ currentBattle: null })
      const command = createCommitFleetCommand(['card_1', 'card_2', 'card_3', 'card_4', 'card_5'])

      // When/Then
      expect(() => handleCommitFleet(command, state)).toThrow(CardSelectionError)
      expect(() => handleCommitFleet(command, state)).toThrow('No active battle')
    })
  })
})

// ----------------------------------------------------------------------------
// Read Model Projection Tests
// ----------------------------------------------------------------------------

describe('Card Selection Read Model', () => {
  describe('createCardSelectionProjection', () => {
    it('should handle CARD_GAINED events', () => {
      // Given
      const { initialState, reducer } = createCardSelectionProjection()
      const event: GameEvent = {
        type: 'CARD_GAINED',
        data: {
          timestamp: new Date().toISOString(),
          cardId: 'card_new',
          factionId: 'ironveil',
          source: 'quest',
          name: 'New Card',
          attack: 4,
          defense: 3,
          hull: 5,
          agility: 3,
          energyCost: 2
        }
      }

      // When
      const state = reducer(initialState, event)

      // Then
      expect(state.ownedCards).toHaveLength(1)
      expect(state.ownedCards[0].id).toBe('card_new')
    })

    it('should handle CARD_LOST events', () => {
      // Given
      const { initialState, reducer } = createCardSelectionProjection()
      const gainEvent: GameEvent = {
        type: 'CARD_GAINED',
        data: {
          timestamp: new Date().toISOString(),
          cardId: 'card_1',
          factionId: 'ironveil',
          source: 'quest',
          name: 'Card 1',
          attack: 4,
          defense: 3,
          hull: 5,
          agility: 3,
          energyCost: 2
        }
      }
      const stateWithCard = reducer(initialState, gainEvent)

      const lostEvent: GameEvent = {
        type: 'CARD_LOST',
        data: {
          timestamp: new Date().toISOString(),
          cardId: 'card_1',
          factionId: 'ironveil',
          reason: 'penalty'
        }
      }

      // When
      const finalState = reducer(stateWithCard, lostEvent)

      // Then
      expect(finalState.ownedCards).toHaveLength(0)
    })

    it('should handle BATTLE_TRIGGERED events', () => {
      // Given
      const { initialState, reducer } = createCardSelectionProjection()
      const event: GameEvent = {
        type: 'BATTLE_TRIGGERED',
        data: {
          timestamp: new Date().toISOString(),
          battleId: 'battle_001',
          questId: 'quest_001',
          context: 'Test battle',
          opponentType: 'scavengers',
          opponentFactionId: 'scavengers',
          difficulty: 'medium'
        }
      }

      // When
      const state = reducer(initialState, event)

      // Then
      expect(state.currentBattle).toEqual({
        battleId: 'battle_001',
        selectedCardIds: []
      })
    })

    it('should handle CARD_SELECTED events', () => {
      // Given
      const { initialState, reducer } = createCardSelectionProjection()
      const battleEvent: GameEvent = {
        type: 'BATTLE_TRIGGERED',
        data: {
          timestamp: new Date().toISOString(),
          battleId: 'battle_001',
          questId: 'quest_001',
          context: 'Test battle',
          opponentType: 'scavengers',
          opponentFactionId: 'scavengers',
          difficulty: 'medium'
        }
      }
      const stateWithBattle = reducer(initialState, battleEvent)

      const selectEvent: GameEvent = {
        type: 'CARD_SELECTED',
        data: {
          timestamp: new Date().toISOString(),
          cardId: 'card_1',
          battleId: 'battle_001'
        }
      }

      // When
      const state = reducer(stateWithBattle, selectEvent)

      // Then
      expect(state.currentBattle?.selectedCardIds).toContain('card_1')
    })

    it('should handle CARD_DESELECTED events', () => {
      // Given
      const { initialState, reducer } = createCardSelectionProjection()
      const events: GameEvent[] = [
        {
          type: 'BATTLE_TRIGGERED',
          data: {
            timestamp: new Date().toISOString(),
            battleId: 'battle_001',
            questId: 'quest_001',
            context: 'Test battle',
            opponentType: 'scavengers',
            opponentFactionId: 'scavengers',
            difficulty: 'medium'
          }
        },
        {
          type: 'CARD_SELECTED',
          data: {
            timestamp: new Date().toISOString(),
            cardId: 'card_1',
            battleId: 'battle_001'
          }
        }
      ]
      const stateWithSelection = events.reduce(reducer, initialState)

      const deselectEvent: GameEvent = {
        type: 'CARD_DESELECTED',
        data: {
          timestamp: new Date().toISOString(),
          cardId: 'card_1',
          battleId: 'battle_001'
        }
      }

      // When
      const state = reducer(stateWithSelection, deselectEvent)

      // Then
      expect(state.currentBattle?.selectedCardIds).not.toContain('card_1')
    })

    it('should handle BATTLE_RESOLVED events', () => {
      // Given
      const { initialState, reducer } = createCardSelectionProjection()
      const battleEvent: GameEvent = {
        type: 'BATTLE_TRIGGERED',
        data: {
          timestamp: new Date().toISOString(),
          battleId: 'battle_001',
          questId: 'quest_001',
          context: 'Test battle',
          opponentType: 'scavengers',
          opponentFactionId: 'scavengers',
          difficulty: 'medium'
        }
      }
      const stateWithBattle = reducer(initialState, battleEvent)

      const resolveEvent: GameEvent = {
        type: 'BATTLE_RESOLVED',
        data: {
          timestamp: new Date().toISOString(),
          battleId: 'battle_001',
          outcome: 'victory',
          playerWins: 3,
          opponentWins: 1,
          draws: 1,
          roundsSummary: []
        }
      }

      // When
      const state = reducer(stateWithBattle, resolveEvent)

      // Then
      expect(state.currentBattle).toBeNull()
    })
  })
})

// ----------------------------------------------------------------------------
// Constants Tests
// ----------------------------------------------------------------------------

describe('Card Selection Constants', () => {
  it('MAX_FLEET_SIZE should be 5', () => {
    expect(MAX_FLEET_SIZE).toBe(5)
  })
})

// ----------------------------------------------------------------------------
// Command Factory Tests
// ----------------------------------------------------------------------------

describe('Command Factories', () => {
  it('createSelectCardCommand creates valid command', () => {
    const command = createSelectCardCommand('card_1')
    expect(command).toEqual({
      type: 'SELECT_CARD',
      data: { cardId: 'card_1' }
    })
  })

  it('createDeselectCardCommand creates valid command', () => {
    const command = createDeselectCardCommand('card_1')
    expect(command).toEqual({
      type: 'DESELECT_CARD',
      data: { cardId: 'card_1' }
    })
  })

  it('createCommitFleetCommand creates valid command', () => {
    const command = createCommitFleetCommand(['card_1', 'card_2', 'card_3', 'card_4', 'card_5'])
    expect(command).toEqual({
      type: 'COMMIT_FLEET',
      data: { cardIds: ['card_1', 'card_2', 'card_3', 'card_4', 'card_5'] }
    })
  })
})
