// ============================================================================
// DEPLOYMENT SLICE - Tests
// ============================================================================
//
// Tests for deployment command handlers and read model projections.
// Follows Given-When-Then specification pattern.
// ============================================================================

import { describe, it, expect, vi } from 'vitest'
import type { GameEvent } from '../../../game/events'
import type { FactionId, OwnedCard } from '../../../game/types'
import {
  handleSetCardPosition,
  handleLockOrders,
  createSetCardPositionCommand,
  createLockOrdersCommand,
  DeploymentError,
  TOTAL_POSITIONS,
  type DeploymentState
} from '../command'
import {
  createDeploymentProjection,
  buildDeploymentView,
  projectDeploymentFromEvents
} from '../read-model'

// ----------------------------------------------------------------------------
// Test Fixtures
// ----------------------------------------------------------------------------

function createOwnedCard(id: string, faction: FactionId): OwnedCard {
  return {
    id,
    name: `Test Card ${id}`,
    faction,
    attack: 10,
    armor: 8,
    agility: 6,
    source: 'quest',
    acquiredAt: new Date().toISOString(),
    isLocked: false
  }
}

function createDeploymentState(overrides: Partial<DeploymentState> = {}): DeploymentState {
  return {
    currentPhase: 'deployment',
    ownedCards: [
      createOwnedCard('card_1', 'ironveil'),
      createOwnedCard('card_2', 'ironveil'),
      createOwnedCard('card_3', 'ashfall'),
      createOwnedCard('card_4', 'ashfall'),
      createOwnedCard('card_5', 'meridian')
    ],
    currentBattle: {
      battleId: 'battle_001',
      questId: 'quest_001',
      context: 'Test battle',
      opponentType: 'scavengers',
      difficulty: 'medium',
      selectedCardIds: ['card_1', 'card_2', 'card_3', 'card_4', 'card_5'],
      positions: [null, null, null, null, null]
    },
    activeQuest: {
      questId: 'quest_001'
    },
    ...overrides
  }
}

// ----------------------------------------------------------------------------
// SET_CARD_POSITION Command Handler Tests
// ----------------------------------------------------------------------------

describe('SET_CARD_POSITION Command Handler', () => {
  describe('Given player in deployment phase with active battle', () => {
    it('When SET_CARD_POSITION with valid card and position, Then CARD_POSITIONED event emitted', () => {
      // Given
      const state = createDeploymentState()
      const command = createSetCardPositionCommand('card_1', 1)

      // When
      const events = handleSetCardPosition(command, state)

      // Then
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        type: 'CARD_POSITIONED',
        data: {
          cardId: 'card_1',
          position: 1,
          battleId: 'battle_001'
        }
      })
    })

    it('When SET_CARD_POSITION with position 5 (max), Then CARD_POSITIONED event emitted', () => {
      // Given
      const state = createDeploymentState()
      const command = createSetCardPositionCommand('card_5', 5)

      // When
      const events = handleSetCardPosition(command, state)

      // Then
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        type: 'CARD_POSITIONED',
        data: {
          cardId: 'card_5',
          position: 5,
          battleId: 'battle_001'
        }
      })
    })

    it('When SET_CARD_POSITION with position 0 (below min), Then DeploymentError thrown', () => {
      // Given
      const state = createDeploymentState()
      const command = createSetCardPositionCommand('card_1', 0)

      // When/Then
      expect(() => handleSetCardPosition(command, state)).toThrow(DeploymentError)
      expect(() => handleSetCardPosition(command, state)).toThrow('Position must be 1-5')
    })

    it('When SET_CARD_POSITION with position 6 (above max), Then DeploymentError thrown', () => {
      // Given
      const state = createDeploymentState()
      const command = createSetCardPositionCommand('card_1', 6)

      // When/Then
      expect(() => handleSetCardPosition(command, state)).toThrow(DeploymentError)
      expect(() => handleSetCardPosition(command, state)).toThrow('Position must be 1-5')
    })

    it('When SET_CARD_POSITION with card not in selected fleet, Then DeploymentError thrown', () => {
      // Given
      const state = createDeploymentState()
      const command = createSetCardPositionCommand('card_not_selected', 1)

      // When/Then
      expect(() => handleSetCardPosition(command, state)).toThrow(DeploymentError)
      expect(() => handleSetCardPosition(command, state)).toThrow('Card not in selected fleet')
    })

    it('When repositioning card from one slot to another, Then event emitted (repositioning allowed)', () => {
      // Given
      const state = createDeploymentState({
        currentBattle: {
          battleId: 'battle_001',
          questId: 'quest_001',
          context: 'Test battle',
          opponentType: 'scavengers',
          difficulty: 'medium',
          selectedCardIds: ['card_1', 'card_2', 'card_3', 'card_4', 'card_5'],
          positions: ['card_1', null, null, null, null]  // card_1 already in position 1
        }
      })
      const command = createSetCardPositionCommand('card_1', 3)  // Move to position 3

      // When
      const events = handleSetCardPosition(command, state)

      // Then
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        type: 'CARD_POSITIONED',
        data: {
          cardId: 'card_1',
          position: 3,
          battleId: 'battle_001'
        }
      })
    })
  })

  describe('Given player NOT in deployment phase', () => {
    it('When SET_CARD_POSITION, Then DeploymentError thrown', () => {
      // Given
      const state = createDeploymentState({ currentPhase: 'card_selection' })
      const command = createSetCardPositionCommand('card_1', 1)

      // When/Then
      expect(() => handleSetCardPosition(command, state)).toThrow(DeploymentError)
      expect(() => handleSetCardPosition(command, state)).toThrow('Not in deployment phase')
    })
  })

  describe('Given player with no active battle', () => {
    it('When SET_CARD_POSITION, Then DeploymentError thrown', () => {
      // Given
      const state = createDeploymentState({ currentBattle: null })
      const command = createSetCardPositionCommand('card_1', 1)

      // When/Then
      expect(() => handleSetCardPosition(command, state)).toThrow(DeploymentError)
      expect(() => handleSetCardPosition(command, state)).toThrow('No active battle')
    })
  })
})

// ----------------------------------------------------------------------------
// LOCK_ORDERS Command Handler Tests
// ----------------------------------------------------------------------------

describe('LOCK_ORDERS Command Handler', () => {
  describe('Given player with all 5 positions filled', () => {
    it('When LOCK_ORDERS, Then ORDERS_LOCKED, battle events, and PHASE_CHANGED emitted', () => {
      // Given
      const positions = ['card_1', 'card_2', 'card_3', 'card_4', 'card_5']
      const state = createDeploymentState({
        currentBattle: {
          battleId: 'battle_001',
          questId: 'quest_001',
          context: 'Test battle',
          opponentType: 'scavengers',
          difficulty: 'medium',
          selectedCardIds: positions,
          positions: [null, null, null, null, null]  // Positions now come from command, not state
        }
      })
      const command = createLockOrdersCommand(positions)

      // When
      const events = handleLockOrders(command, state)

      // Then
      expect(events.length).toBeGreaterThanOrEqual(3)  // At minimum: ORDERS_LOCKED, ROUND_STARTED, PHASE_CHANGED
      expect(events[0]).toMatchObject({
        type: 'ORDERS_LOCKED',
        data: {
          battleId: 'battle_001',
          positions: ['card_1', 'card_2', 'card_3', 'card_4', 'card_5']
        }
      })
      // Second event should be PHASE_CHANGED to battle
      expect(events[1]).toMatchObject({
        type: 'PHASE_CHANGED',
        data: {
          fromPhase: 'deployment',
          toPhase: 'battle'
        }
      })
      // Last event should be PHASE_CHANGED to consequence (after battle resolves)
      expect(events[events.length - 1]).toMatchObject({
        type: 'PHASE_CHANGED',
        data: {
          fromPhase: 'battle',
          toPhase: 'consequence'
        }
      })
    })

    it('When LOCK_ORDERS, Then battle events are generated (ROUND_STARTED, etc.)', () => {
      // Given
      const positions = ['card_1', 'card_2', 'card_3', 'card_4', 'card_5']
      const state = createDeploymentState({
        currentBattle: {
          battleId: 'battle_001',
          questId: 'quest_001',
          context: 'Test battle',
          opponentType: 'scavengers',
          difficulty: 'medium',
          selectedCardIds: positions,
          positions: [null, null, null, null, null]
        }
      })
      const command = createLockOrdersCommand(positions)

      // When
      const events = handleLockOrders(command, state)

      // Then - verify battle events are present
      const roundStartedEvents = events.filter(e => e.type === 'ROUND_STARTED')
      expect(roundStartedEvents.length).toBeGreaterThan(0)
    })
  })

  describe('Given player with positions not fully filled', () => {
    it('When LOCK_ORDERS with 4 positions filled, Then DeploymentError thrown', () => {
      // Given
      const state = createDeploymentState({
        currentBattle: {
          battleId: 'battle_001',
          questId: 'quest_001',
          context: 'Test battle',
          opponentType: 'scavengers',
          difficulty: 'medium',
          selectedCardIds: ['card_1', 'card_2', 'card_3', 'card_4', 'card_5'],
          positions: [null, null, null, null, null]
        }
      })
      // Command has only 4 positions
      const command = createLockOrdersCommand(['card_1', 'card_2', 'card_3', 'card_4'])

      // When/Then
      expect(() => handleLockOrders(command, state)).toThrow(DeploymentError)
      expect(() => handleLockOrders(command, state)).toThrow('All 5 positions must be filled')
    })

    it('When LOCK_ORDERS with all positions empty, Then DeploymentError thrown', () => {
      // Given
      const state = createDeploymentState({
        currentBattle: {
          battleId: 'battle_001',
          questId: 'quest_001',
          context: 'Test battle',
          opponentType: 'scavengers',
          difficulty: 'medium',
          selectedCardIds: ['card_1', 'card_2', 'card_3', 'card_4', 'card_5'],
          positions: [null, null, null, null, null]
        }
      })
      // Command has empty array
      const command = createLockOrdersCommand([])

      // When/Then
      expect(() => handleLockOrders(command, state)).toThrow(DeploymentError)
      expect(() => handleLockOrders(command, state)).toThrow('All 5 positions must be filled')
    })
  })

  describe('Given player NOT in deployment phase', () => {
    it('When LOCK_ORDERS, Then DeploymentError thrown', () => {
      // Given
      const positions = ['card_1', 'card_2', 'card_3', 'card_4', 'card_5']
      const state = createDeploymentState({
        currentPhase: 'card_selection',
        currentBattle: {
          battleId: 'battle_001',
          questId: 'quest_001',
          context: 'Test battle',
          opponentType: 'scavengers',
          difficulty: 'medium',
          selectedCardIds: positions,
          positions: [null, null, null, null, null]
        }
      })
      const command = createLockOrdersCommand(positions)

      // When/Then
      expect(() => handleLockOrders(command, state)).toThrow(DeploymentError)
      expect(() => handleLockOrders(command, state)).toThrow('Not in deployment phase')
    })
  })

  describe('Given player with no active battle', () => {
    it('When LOCK_ORDERS, Then DeploymentError thrown', () => {
      // Given
      const state = createDeploymentState({ currentBattle: null })
      const command = createLockOrdersCommand(['card_1', 'card_2', 'card_3', 'card_4', 'card_5'])

      // When/Then
      expect(() => handleLockOrders(command, state)).toThrow(DeploymentError)
      expect(() => handleLockOrders(command, state)).toThrow('No active battle')
    })
  })
})

// ----------------------------------------------------------------------------
// Read Model Projection Tests
// ----------------------------------------------------------------------------

describe('Deployment Read Model', () => {
  describe('createDeploymentProjection', () => {
    it('should handle BATTLE_TRIGGERED events', () => {
      // Given
      const { initialState, reducer } = createDeploymentProjection()
      const event: GameEvent = {
        type: 'BATTLE_TRIGGERED',
        data: {
          timestamp: new Date().toISOString(),
          battleId: 'battle_001',
          questId: 'quest_001',
          context: 'Combat ahead',
          opponentType: 'scavengers',
          opponentFactionId: 'scavengers' as FactionId | 'scavengers',
          difficulty: 'medium'
        }
      }

      // When
      const state = reducer(initialState, event)

      // Then
      expect(state.currentBattle).toEqual({
        battleId: 'battle_001',
        context: 'Combat ahead',
        selectedCardIds: [],
        positions: [null, null, null, null, null]
      })
    })

    it('should handle FLEET_COMMITTED events', () => {
      // Given
      const { initialState, reducer } = createDeploymentProjection()
      const battleEvent: GameEvent = {
        type: 'BATTLE_TRIGGERED',
        data: {
          timestamp: new Date().toISOString(),
          battleId: 'battle_001',
          questId: 'quest_001',
          context: 'Combat ahead',
          opponentType: 'scavengers',
          opponentFactionId: 'scavengers' as FactionId | 'scavengers',
          difficulty: 'medium'
        }
      }
      const stateWithBattle = reducer(initialState, battleEvent)

      const commitEvent: GameEvent = {
        type: 'FLEET_COMMITTED',
        data: {
          timestamp: new Date().toISOString(),
          battleId: 'battle_001',
          cardIds: ['card_1', 'card_2', 'card_3', 'card_4', 'card_5']
        }
      }

      // When
      const state = reducer(stateWithBattle, commitEvent)

      // Then
      expect(state.currentBattle?.selectedCardIds).toEqual(['card_1', 'card_2', 'card_3', 'card_4', 'card_5'])
      expect(state.currentBattle?.positions).toEqual([null, null, null, null, null])
    })

    it('should handle CARD_POSITIONED events', () => {
      // Given
      const { initialState, reducer } = createDeploymentProjection()
      const events: GameEvent[] = [
        {
          type: 'BATTLE_TRIGGERED',
          data: {
            timestamp: new Date().toISOString(),
            battleId: 'battle_001',
            questId: 'quest_001',
            context: 'Combat ahead',
            opponentType: 'scavengers',
            opponentFactionId: 'scavengers' as FactionId | 'scavengers',
            difficulty: 'medium'
          }
        },
        {
          type: 'FLEET_COMMITTED',
          data: {
            timestamp: new Date().toISOString(),
            battleId: 'battle_001',
            cardIds: ['card_1', 'card_2', 'card_3', 'card_4', 'card_5']
          }
        }
      ]
      const stateWithFleet = events.reduce(reducer, initialState)

      const positionEvent: GameEvent = {
        type: 'CARD_POSITIONED',
        data: {
          timestamp: new Date().toISOString(),
          cardId: 'card_1',
          position: 1,
          battleId: 'battle_001'
        }
      }

      // When
      const state = reducer(stateWithFleet, positionEvent)

      // Then
      expect(state.currentBattle?.positions[0]).toBe('card_1')
    })

    it('should handle repositioning (clear old position when card moved)', () => {
      // Given
      const { initialState, reducer } = createDeploymentProjection()
      const events: GameEvent[] = [
        {
          type: 'BATTLE_TRIGGERED',
          data: {
            timestamp: new Date().toISOString(),
            battleId: 'battle_001',
            questId: 'quest_001',
            context: 'Combat ahead',
            opponentType: 'scavengers',
            opponentFactionId: 'scavengers' as FactionId | 'scavengers',
            difficulty: 'medium'
          }
        },
        {
          type: 'FLEET_COMMITTED',
          data: {
            timestamp: new Date().toISOString(),
            battleId: 'battle_001',
            cardIds: ['card_1', 'card_2', 'card_3', 'card_4', 'card_5']
          }
        },
        {
          type: 'CARD_POSITIONED',
          data: {
            timestamp: new Date().toISOString(),
            cardId: 'card_1',
            position: 1,
            battleId: 'battle_001'
          }
        }
      ]
      const stateWithCard = events.reduce(reducer, initialState)

      // Reposition card_1 from position 1 to position 3
      const repositionEvent: GameEvent = {
        type: 'CARD_POSITIONED',
        data: {
          timestamp: new Date().toISOString(),
          cardId: 'card_1',
          position: 3,
          battleId: 'battle_001'
        }
      }

      // When
      const state = reducer(stateWithCard, repositionEvent)

      // Then
      expect(state.currentBattle?.positions[0]).toBeNull()  // Position 1 now empty
      expect(state.currentBattle?.positions[2]).toBe('card_1')  // Position 3 has card_1
    })

    it('should handle BATTLE_RESOLVED events (clear battle)', () => {
      // Given
      const { initialState, reducer } = createDeploymentProjection()
      const battleEvent: GameEvent = {
        type: 'BATTLE_TRIGGERED',
        data: {
          timestamp: new Date().toISOString(),
          battleId: 'battle_001',
          questId: 'quest_001',
          context: 'Combat ahead',
          opponentType: 'scavengers',
          opponentFactionId: 'scavengers' as FactionId | 'scavengers',
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
          opponentWins: 2,
          draws: 0,
          roundsSummary: []
        }
      }

      // When
      const state = reducer(stateWithBattle, resolveEvent)

      // Then
      expect(state.currentBattle).toBeNull()
    })
  })

  describe('buildDeploymentView', () => {
    it('should calculate canLockOrders correctly when all positions filled', () => {
      // Given
      const { initialState, reducer } = createDeploymentProjection()
      const events: GameEvent[] = [
        {
          type: 'BATTLE_TRIGGERED',
          data: {
            timestamp: new Date().toISOString(),
            battleId: 'battle_001',
            questId: 'quest_001',
            context: 'Combat ahead',
            opponentType: 'scavengers',
            opponentFactionId: 'scavengers' as FactionId | 'scavengers',
            difficulty: 'medium'
          }
        },
        {
          type: 'FLEET_COMMITTED',
          data: {
            timestamp: new Date().toISOString(),
            battleId: 'battle_001',
            cardIds: ['card_1', 'card_2', 'card_3', 'card_4', 'card_5']
          }
        },
        {
          type: 'CARD_POSITIONED',
          data: { timestamp: new Date().toISOString(), cardId: 'card_1', position: 1, battleId: 'battle_001' }
        },
        {
          type: 'CARD_POSITIONED',
          data: { timestamp: new Date().toISOString(), cardId: 'card_2', position: 2, battleId: 'battle_001' }
        },
        {
          type: 'CARD_POSITIONED',
          data: { timestamp: new Date().toISOString(), cardId: 'card_3', position: 3, battleId: 'battle_001' }
        },
        {
          type: 'CARD_POSITIONED',
          data: { timestamp: new Date().toISOString(), cardId: 'card_4', position: 4, battleId: 'battle_001' }
        },
        {
          type: 'CARD_POSITIONED',
          data: { timestamp: new Date().toISOString(), cardId: 'card_5', position: 5, battleId: 'battle_001' }
        }
      ]
      const state = events.reduce(reducer, initialState)

      // When
      const view = buildDeploymentView(state, events)

      // Then
      expect(view).not.toBeNull()
      expect(view?.canLockOrders).toBe(true)
      expect(view?.assignedCount).toBe(5)
      expect(view?.unassignedCards).toHaveLength(0)
    })

    it('should calculate canLockOrders correctly when positions not all filled', () => {
      // Given
      const { initialState, reducer } = createDeploymentProjection()
      const events: GameEvent[] = [
        {
          type: 'BATTLE_TRIGGERED',
          data: {
            timestamp: new Date().toISOString(),
            battleId: 'battle_001',
            questId: 'quest_001',
            context: 'Combat ahead',
            opponentType: 'scavengers',
            opponentFactionId: 'scavengers' as FactionId | 'scavengers',
            difficulty: 'medium'
          }
        },
        {
          type: 'FLEET_COMMITTED',
          data: {
            timestamp: new Date().toISOString(),
            battleId: 'battle_001',
            cardIds: ['card_1', 'card_2', 'card_3', 'card_4', 'card_5']
          }
        },
        {
          type: 'CARD_POSITIONED',
          data: { timestamp: new Date().toISOString(), cardId: 'card_1', position: 1, battleId: 'battle_001' }
        },
        {
          type: 'CARD_POSITIONED',
          data: { timestamp: new Date().toISOString(), cardId: 'card_2', position: 2, battleId: 'battle_001' }
        }
        // Only 2 cards positioned
      ]
      const state = events.reduce(reducer, initialState)

      // When
      const view = buildDeploymentView(state, events)

      // Then
      expect(view).not.toBeNull()
      expect(view?.canLockOrders).toBe(false)
      expect(view?.assignedCount).toBe(2)
      // Note: unassignedCards depends on card data from game state, which requires
      // CARD_GAINED events. For this test, we focus on canLockOrders and assignedCount.
    })

    it('should return null when no active battle', () => {
      // Given
      const { initialState } = createDeploymentProjection()

      // When
      const view = buildDeploymentView(initialState, [])

      // Then
      expect(view).toBeNull()
    })
  })
})

// ----------------------------------------------------------------------------
// Constants Tests
// ----------------------------------------------------------------------------

describe('Deployment Constants', () => {
  it('TOTAL_POSITIONS should be 5', () => {
    expect(TOTAL_POSITIONS).toBe(5)
  })
})

// ----------------------------------------------------------------------------
// Command Factory Tests
// ----------------------------------------------------------------------------

describe('Command Factories', () => {
  it('createSetCardPositionCommand creates valid command', () => {
    const command = createSetCardPositionCommand('card_1', 3)
    expect(command).toEqual({
      type: 'SET_CARD_POSITION',
      data: { cardId: 'card_1', position: 3 }
    })
  })

  it('createLockOrdersCommand creates valid command', () => {
    const positions = ['card_1', 'card_2', 'card_3', 'card_4', 'card_5']
    const command = createLockOrdersCommand(positions)
    expect(command).toEqual({
      type: 'LOCK_ORDERS',
      data: { positions }
    })
  })
})
