import { describe, it, expect } from 'vitest'
import { decide, InvalidCommandError } from '../decider'
import { evolveState, getInitialState } from '../projections'
import type { GameState } from '../state'
import type { GameEvent } from '../events'

describe('Round Limit - Full Game Flow', () => {
  /**
   * Simulate a full tactical battle by applying events and ending turns
   * This simulates the new architecture where:
   * 1. Player END_TURN transitions to opponent's turn
   * 2. PROCESS_OPPONENT_TURN handles opponent AI and transitions back to player
   */
  function simulateBattle(state: GameState): { finalState: GameState; turnCount: number; resolvedEvent?: GameEvent } {
    let currentState = state
    let turnCount = 0
    const maxTurns = 30

    while (turnCount < maxTurns) {
      // Check if battle is resolved
      if (currentState.currentTacticalBattle?.phase === 'resolved') {
        console.log(`Battle resolved at turn ${currentState.currentTacticalBattle.turnNumber}`)
        break
      }

      const activePlayer = currentState.currentTacticalBattle?.activePlayer

      if (activePlayer === 'player') {
        // Player ends their turn
        try {
          const events = decide({ type: 'END_TURN', data: {} }, currentState)

          console.log(`Player turn ${turnCount + 1}: Generated ${events.length} events:`)
          events.forEach(e => console.log(`  - ${e.type}`))

          // Apply all events
          for (const event of events) {
            currentState = evolveState(currentState, event)
          }

          // Check for resolved event
          const resolvedEvent = events.find(e => e.type === 'TACTICAL_BATTLE_RESOLVED')
          if (resolvedEvent) {
            return { finalState: currentState, turnCount: turnCount + 1, resolvedEvent }
          }

          turnCount++
        } catch (e) {
          if (e instanceof InvalidCommandError) {
            console.log(`Invalid command: ${e.message}`)
            break
          }
          throw e
        }
      } else if (activePlayer === 'opponent') {
        // Process opponent's turn (simulating what the game store auto-dispatches)
        try {
          const events = decide({ type: 'PROCESS_OPPONENT_TURN', data: {} }, currentState)

          console.log(`Opponent turn: Generated ${events.length} events:`)
          events.forEach(e => console.log(`  - ${e.type}`))

          // Apply all events
          for (const event of events) {
            currentState = evolveState(currentState, event)
          }

          // Check for resolved event
          const resolvedEvent = events.find(e => e.type === 'TACTICAL_BATTLE_RESOLVED')
          if (resolvedEvent) {
            return { finalState: currentState, turnCount, resolvedEvent }
          }
        } catch (e) {
          if (e instanceof InvalidCommandError) {
            console.log(`Invalid command (opponent): ${e.message}`)
            break
          }
          throw e
        }
      } else {
        console.log(`Unexpected activePlayer: ${activePlayer}`)
        break
      }
    }

    return { finalState: currentState, turnCount }
  }

  it('should resolve battle after 5 rounds (approximately 5 End Turn clicks)', () => {
    // Start with a game that has a tactical battle in progress
    const initialState = getInitialState()

    // Simulate starting a quest and battle
    let state = initialState

    // Apply events to set up a battle
    const setupEvents: GameEvent[] = [
      {
        type: 'GAME_STARTED',
        data: {
          timestamp: '2024-01-01T00:00:00.000Z',
          playerName: 'Test Player',
          version: '1.0',
          seed: 12345
        }
      },
      {
        type: 'QUEST_ACCEPTED',
        data: {
          timestamp: '2024-01-01T00:00:01.000Z',
          questId: 'trade_route_dispute',
          questTitle: 'Test Quest',
          difficulty: 'medium',
          primaryFaction: 'ironveil',
          location: 'Test Location'
        }
      },
      {
        type: 'TACTICAL_BATTLE_STARTED',
        data: {
          timestamp: '2024-01-01T00:00:02.000Z',
          battleId: 'test-battle',
          questId: 'trade_route_dispute',
          context: 'Test battle',
          playerDeckCardIds: ['lightning_wing', 'scout_craft', 'patrol_vessel', 'interceptor'],
          opponentDeckCardIds: ['patrol_vessel', 'scout_craft', 'interceptor', 'lightning_wing'],
          opponentName: 'Test Opponent',
          opponentFactionId: 'ironveil',
          difficulty: 'medium',
          playerFlagshipHull: 100,
          opponentFlagshipHull: 100,
          firstPlayer: 'player',
          initiativeReason: 'agility'
        }
      },
      // Skip mulligan - start first turn directly
      {
        type: 'TACTICAL_TURN_STARTED',
        data: {
          timestamp: '2024-01-01T00:00:03.000Z',
          battleId: 'test-battle',
          turnNumber: 0,
          activePlayer: 'player',
          energyGained: 5,
          newEnergyTotal: 5
        }
      }
    ]

    for (const event of setupEvents) {
      state = evolveState(state, event)
    }

    console.log('Initial battle state:')
    console.log(`  Phase: ${state.currentTacticalBattle?.phase}`)
    console.log(`  Turn: ${state.currentTacticalBattle?.turnNumber}`)
    console.log(`  Active: ${state.currentTacticalBattle?.activePlayer}`)
    console.log(`  Round Limit: ${state.currentTacticalBattle?.roundLimit}`)

    // Run the battle
    const { finalState, turnCount, resolvedEvent } = simulateBattle(state)

    console.log(`\nFinal state:`)
    console.log(`  Phase: ${finalState.currentTacticalBattle?.phase}`)
    console.log(`  Turn: ${finalState.currentTacticalBattle?.turnNumber}`)
    console.log(`  End Turn clicks: ${turnCount}`)

    // Battle should resolve after approximately 5 End Turn clicks (5 rounds)
    expect(turnCount).toBeLessThanOrEqual(6)
    expect(finalState.currentTacticalBattle?.phase).toBe('resolved')
    expect(resolvedEvent).toBeDefined()
    expect(resolvedEvent?.data?.victoryCondition).toBe('timeout')
  })
})
