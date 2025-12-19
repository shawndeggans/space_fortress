import { describe, it, expect, beforeEach } from 'vitest'
import {
  rollD20,
  setRngSeed,
  resolveInitiative,
  resolveAttack,
  resolveAttackWithRoll,
  determineRoundOutcome,
  resolveRound,
  resolveRoundWithRolls,
  resolveBattle,
  resolveBattleWithRolls,
  determineBattleOutcome,
  generateBattleEvents,
  executeBattle
} from '../combat'
import type { Card } from '../types'

// Helper to create test cards
function createCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'test_card',
    name: 'Test Card',
    faction: 'meridian',
    attack: 3,
    defense: 3,
    hull: 5,
    agility: 3,
    energyCost: 2,
    abilities: [],
    ...overrides
  }
}

// Helper to create a fleet of 5 cards
function createFleet(baseStats: Partial<Card> = {}): Card[] {
  return Array.from({ length: 5 }, (_, i) =>
    createCard({
      id: `card_${i}`,
      name: `Card ${i + 1}`,
      ...baseStats
    })
  )
}

describe('D20 Rolling', () => {
  beforeEach(() => {
    setRngSeed(null)  // Reset to random
  })

  it('rolls values between 1 and 20', () => {
    const rolls = Array.from({ length: 100 }, () => rollD20())

    expect(Math.min(...rolls)).toBeGreaterThanOrEqual(1)
    expect(Math.max(...rolls)).toBeLessThanOrEqual(20)
  })

  it('produces deterministic results with seed', () => {
    setRngSeed(12345)
    const rolls1 = Array.from({ length: 10 }, () => rollD20())

    setRngSeed(12345)
    const rolls2 = Array.from({ length: 10 }, () => rollD20())

    expect(rolls1).toEqual(rolls2)
  })

  it('produces different results with different seeds', () => {
    setRngSeed(12345)
    const rolls1 = Array.from({ length: 10 }, () => rollD20())

    setRngSeed(54321)
    const rolls2 = Array.from({ length: 10 }, () => rollD20())

    expect(rolls1).not.toEqual(rolls2)
  })
})

describe('Initiative Resolution', () => {
  it('player strikes first with higher agility', () => {
    const result = resolveInitiative(5, 3)
    expect(result.firstStriker).toBe('player')
    expect(result.playerAgility).toBe(5)
    expect(result.opponentAgility).toBe(3)
  })

  it('opponent strikes first with higher agility', () => {
    const result = resolveInitiative(2, 4)
    expect(result.firstStriker).toBe('opponent')
  })

  it('simultaneous on equal agility', () => {
    const result = resolveInitiative(3, 3)
    expect(result.firstStriker).toBe('simultaneous')
  })
})

describe('Attack Resolution', () => {
  it('calculates hit correctly (hit case)', () => {
    // Roll 15 + Attack 4 = 19 vs 10 + Armor 3 = 13 → HIT
    const result = resolveAttackWithRoll(15, 4, 3)
    expect(result.base).toBe(15)
    expect(result.modifier).toBe(4)
    expect(result.total).toBe(19)
    expect(result.target).toBe(13)
    expect(result.hit).toBe(true)
  })

  it('calculates hit correctly (miss case)', () => {
    // Roll 5 + Attack 3 = 8 vs 10 + Armor 4 = 14 → MISS
    const result = resolveAttackWithRoll(5, 3, 4)
    expect(result.base).toBe(5)
    expect(result.modifier).toBe(3)
    expect(result.total).toBe(8)
    expect(result.target).toBe(14)
    expect(result.hit).toBe(false)
  })

  it('exact target number is a hit', () => {
    // Roll 10 + Attack 3 = 13 vs 10 + Armor 3 = 13 → HIT (equal counts as hit)
    const result = resolveAttackWithRoll(10, 3, 3)
    expect(result.hit).toBe(true)
  })

  it('handles high armor', () => {
    // Roll 18 + Attack 2 = 20 vs 10 + Armor 8 = 18 → HIT
    const result = resolveAttackWithRoll(18, 2, 8)
    expect(result.hit).toBe(true)
  })

  it('handles low armor', () => {
    // Roll 8 + Attack 2 = 10 vs 10 + Armor 1 = 11 → MISS
    const result = resolveAttackWithRoll(8, 2, 1)
    expect(result.hit).toBe(false)
  })
})

describe('Round Outcome', () => {
  it('player wins when only player hits', () => {
    expect(determineRoundOutcome(true, false)).toBe('player_won')
  })

  it('opponent wins when only opponent hits', () => {
    expect(determineRoundOutcome(false, true)).toBe('opponent_won')
  })

  it('draw when both hit', () => {
    expect(determineRoundOutcome(true, true)).toBe('draw')
  })

  it('draw when neither hits', () => {
    expect(determineRoundOutcome(false, false)).toBe('draw')
  })
})

describe('Round Resolution', () => {
  it('resolves a round with predetermined rolls', () => {
    const playerCard = createCard({ attack: 4, defense: 3, agility: 5 })
    const opponentCard = createCard({ attack: 3, defense: 4, agility: 2 })

    // Player rolls 15, hits (15+4=19 vs 14)
    // Opponent rolls 8, misses (8+3=11 vs 13)
    const result = resolveRoundWithRolls(1, playerCard, opponentCard, 15, 8)

    expect(result.roundNumber).toBe(1)
    expect(result.initiative.firstStriker).toBe('player')
    expect(result.playerRoll.hit).toBe(true)
    expect(result.opponentRoll.hit).toBe(false)
    expect(result.outcome).toBe('player_won')
  })

  it('handles simultaneous initiative', () => {
    const playerCard = createCard({ agility: 3 })
    const opponentCard = createCard({ agility: 3 })

    const result = resolveRoundWithRolls(2, playerCard, opponentCard, 10, 10)

    expect(result.initiative.firstStriker).toBe('simultaneous')
  })
})

describe('Battle Resolution', () => {
  it('requires exactly 5 cards per fleet', () => {
    expect(() =>
      resolveBattle('battle-1', createFleet().slice(0, 4), createFleet())
    ).toThrow()

    expect(() =>
      resolveBattle('battle-1', createFleet(), createFleet().slice(0, 3))
    ).toThrow()
  })

  it('resolves a complete battle with predetermined rolls', () => {
    const playerFleet = createFleet({ attack: 4, defense: 3 })
    const opponentFleet = createFleet({ attack: 3, defense: 4 })

    // Player wins rounds 1, 2, 3 (high rolls)
    // Opponent wins rounds 4, 5 (player low rolls)
    const rolls = [
      { player: 18, opponent: 5 },   // Player hits, opponent misses
      { player: 16, opponent: 6 },   // Player hits, opponent misses
      { player: 17, opponent: 4 },   // Player hits, opponent misses
      { player: 4, opponent: 18 },   // Player misses, opponent hits
      { player: 3, opponent: 17 },   // Player misses, opponent hits
    ]

    const result = resolveBattleWithRolls('battle-1', playerFleet, opponentFleet, rolls)

    expect(result.rounds).toHaveLength(5)
    expect(result.playerWins).toBe(3)
    expect(result.opponentWins).toBe(2)
    expect(result.draws).toBe(0)
    expect(result.outcome).toBe('victory')
  })

  it('handles draws correctly', () => {
    const playerFleet = createFleet({ attack: 3, defense: 3 })
    const opponentFleet = createFleet({ attack: 3, defense: 3 })

    // All rounds are draws (both hit or both miss)
    const rolls = [
      { player: 15, opponent: 15 },  // Both hit
      { player: 15, opponent: 15 },  // Both hit
      { player: 5, opponent: 5 },    // Both miss
      { player: 15, opponent: 15 },  // Both hit
      { player: 5, opponent: 5 },    // Both miss
    ]

    const result = resolveBattleWithRolls('battle-1', playerFleet, opponentFleet, rolls)

    expect(result.playerWins).toBe(0)
    expect(result.opponentWins).toBe(0)
    expect(result.draws).toBe(5)
    expect(result.outcome).toBe('draw')
  })

  it('detects defeat correctly', () => {
    const playerFleet = createFleet({ attack: 2, defense: 2 })
    const opponentFleet = createFleet({ attack: 5, defense: 5 })

    // Opponent dominates
    const rolls = [
      { player: 5, opponent: 18 },
      { player: 6, opponent: 17 },
      { player: 7, opponent: 16 },
      { player: 8, opponent: 15 },
      { player: 9, opponent: 14 },
    ]

    const result = resolveBattleWithRolls('battle-1', playerFleet, opponentFleet, rolls)

    expect(result.outcome).toBe('defeat')
  })
})

describe('Battle Outcome Determination', () => {
  it('victory when player wins more rounds', () => {
    expect(determineBattleOutcome(3, 2)).toBe('victory')
    expect(determineBattleOutcome(4, 1)).toBe('victory')
    expect(determineBattleOutcome(5, 0)).toBe('victory')
  })

  it('defeat when opponent wins more rounds', () => {
    expect(determineBattleOutcome(2, 3)).toBe('defeat')
    expect(determineBattleOutcome(1, 4)).toBe('defeat')
    expect(determineBattleOutcome(0, 5)).toBe('defeat')
  })

  it('draw when equal wins', () => {
    expect(determineBattleOutcome(2, 2)).toBe('draw')
    expect(determineBattleOutcome(1, 1)).toBe('draw')
    expect(determineBattleOutcome(0, 0)).toBe('draw')
  })
})

describe('Battle Event Generation', () => {
  it('generates all expected events', () => {
    const playerFleet = createFleet()
    const opponentFleet = createFleet()

    const rolls = [
      { player: 15, opponent: 8 },
      { player: 12, opponent: 10 },
      { player: 18, opponent: 5 },
      { player: 6, opponent: 14 },
      { player: 10, opponent: 10 },
    ]

    const resolution = resolveBattleWithRolls('battle-1', playerFleet, opponentFleet, rolls)

    const events = generateBattleEvents(
      {
        battleId: 'battle-1',
        questId: 'quest-1',
        context: 'Test battle',
        timestamp: '2024-01-01T00:00:00Z'
      },
      playerFleet,
      opponentFleet,
      resolution
    )

    // Count event types
    const eventCounts = events.reduce((counts, e) => {
      counts[e.type] = (counts[e.type] || 0) + 1
      return counts
    }, {} as Record<string, number>)

    expect(eventCounts['BATTLE_STARTED']).toBe(1)
    expect(eventCounts['ROUND_STARTED']).toBe(5)
    expect(eventCounts['CARDS_REVEALED']).toBe(5)
    expect(eventCounts['INITIATIVE_RESOLVED']).toBe(5)
    expect(eventCounts['ATTACK_ROLLED']).toBe(10)  // 2 per round
    expect(eventCounts['ROUND_RESOLVED']).toBe(5)
    expect(eventCounts['BATTLE_RESOLVED']).toBe(1)
  })

  it('includes correct data in events', () => {
    const playerFleet = createFleet({ attack: 4, defense: 3, agility: 5 })
    const opponentFleet = createFleet({ attack: 3, defense: 4, agility: 2 })

    const rolls = [
      { player: 15, opponent: 8 },
      { player: 15, opponent: 8 },
      { player: 15, opponent: 8 },
      { player: 15, opponent: 8 },
      { player: 15, opponent: 8 },
    ]

    const resolution = resolveBattleWithRolls('battle-1', playerFleet, opponentFleet, rolls)

    const events = generateBattleEvents(
      {
        battleId: 'battle-1',
        questId: 'quest-1',
        context: 'Test battle',
        timestamp: '2024-01-01T00:00:00Z'
      },
      playerFleet,
      opponentFleet,
      resolution
    )

    // Check BATTLE_RESOLVED event
    const resolvedEvent = events.find(e => e.type === 'BATTLE_RESOLVED')
    expect(resolvedEvent).toBeDefined()
    if (resolvedEvent?.type === 'BATTLE_RESOLVED') {
      expect(resolvedEvent.data.outcome).toBe('victory')
      expect(resolvedEvent.data.playerWins).toBe(5)
    }

    // Check INITIATIVE_RESOLVED events (player should always strike first)
    const initEvents = events.filter(e => e.type === 'INITIATIVE_RESOLVED')
    for (const event of initEvents) {
      if (event.type === 'INITIATIVE_RESOLVED') {
        expect(event.data.firstStriker).toBe('player')
      }
    }
  })
})

describe('Execute Battle (Integration)', () => {
  beforeEach(() => {
    setRngSeed(42)  // Deterministic for this test
  })

  it('executes a complete battle and returns resolution + events', () => {
    const playerFleet = createFleet({ attack: 4, defense: 4, agility: 3 })
    const opponentFleet = createFleet({ attack: 3, defense: 3, agility: 3 })

    const { resolution, events } = executeBattle(
      {
        battleId: 'battle-1',
        questId: 'quest-1',
        context: 'Test battle',
        timestamp: '2024-01-01T00:00:00Z'
      },
      playerFleet,
      opponentFleet
    )

    expect(resolution.rounds).toHaveLength(5)
    expect(resolution.battleId).toBe('battle-1')
    expect(events.length).toBeGreaterThan(0)
    expect(events[0].type).toBe('BATTLE_STARTED')
    expect(events[events.length - 1].type).toBe('BATTLE_RESOLVED')
  })
})
