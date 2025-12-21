import { describe, it, expect } from 'vitest'
import { generateOpponentTurnEvents } from '../opponentAI'
import type { TacticalBattleState, ShipState } from '../types'

describe('Opponent AI Round Limit', () => {
  function createBattleAtTurn(turnNumber: number): TacticalBattleState {
    return {
      battleId: 'test',
      questId: 'test-quest',
      phase: 'playing',
      turnNumber,
      activePlayer: 'opponent',
      roundLimit: 5,
      player: {
        flagship: { currentHull: 50, maxHull: 100 },
        battlefield: [null, null, null, null, null] as (ShipState | null)[],
        hand: [],
        deck: [],
        energy: { current: 5, maximum: 10, regeneration: 2 }
      },
      opponent: {
        flagship: { currentHull: 50, maxHull: 100 },
        battlefield: [null, null, null, null, null] as (ShipState | null)[],
        hand: [],
        deck: [],
        energy: { current: 5, maximum: 10, regeneration: 2 }
      },
      eventLog: []
    }
  }

  it('should trigger timeout at end of round 5 (turn 9)', () => {
    const battle = createBattleAtTurn(9)
    const events = generateOpponentTurnEvents(battle)

    console.log('Generated events at turn 9:')
    events.forEach(e => console.log(`  - ${e.type}`))

    const resolved = events.find(e => e.type === 'TACTICAL_BATTLE_RESOLVED')
    expect(resolved).toBeDefined()
    expect(resolved?.data?.victoryCondition).toBe('timeout')

    // Should NOT have started player's turn since battle ended
    const turnStarted = events.find(e => e.type === 'TACTICAL_TURN_STARTED')
    expect(turnStarted).toBeUndefined()
  })

  it('should NOT trigger timeout at turn 7 (round 4)', () => {
    const battle = createBattleAtTurn(7)
    const events = generateOpponentTurnEvents(battle)

    console.log('Generated events at turn 7:')
    events.forEach(e => console.log(`  - ${e.type}`))

    const resolved = events.find(e => e.type === 'TACTICAL_BATTLE_RESOLVED')
    expect(resolved).toBeUndefined()

    // Should have started player's turn
    const turnStarted = events.find(e => e.type === 'TACTICAL_TURN_STARTED')
    expect(turnStarted).toBeDefined()
  })

  it('should calculate rounds correctly', () => {
    // Turn 1 = Round 1 (opponent's first turn)
    // Turn 3 = Round 2
    // Turn 5 = Round 3
    // Turn 7 = Round 4
    // Turn 9 = Round 5 (last round with roundLimit=5)

    // Formula: round = ceil((turn + 1) / 2)
    expect(Math.ceil((1 + 1) / 2)).toBe(1)  // Turn 1 = Round 1
    expect(Math.ceil((3 + 1) / 2)).toBe(2)  // Turn 3 = Round 2
    expect(Math.ceil((5 + 1) / 2)).toBe(3)  // Turn 5 = Round 3
    expect(Math.ceil((7 + 1) / 2)).toBe(4)  // Turn 7 = Round 4
    expect(Math.ceil((9 + 1) / 2)).toBe(5)  // Turn 9 = Round 5
    expect(Math.ceil((11 + 1) / 2)).toBe(6) // Turn 11 = Round 6
  })
})
