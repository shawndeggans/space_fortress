import { describe, it, expect } from 'vitest'
import {
  generateOpponentFleet,
  generateAdaptiveFleet,
  calculateFleetStrength,
  getFleetTemplates,
  getCardPool
} from '../opponents'
import type { Card } from '../types'

describe('Opponent Fleet Generation', () => {
  it('generates a fleet with 5 cards', () => {
    const fleet = generateOpponentFleet({
      questId: 'quest-1',
      opponentType: 'scavengers',
      difficulty: 'medium'
    })

    expect(fleet.cards).toHaveLength(5)
    expect(fleet.factionId).toBe('scavengers')
    expect(fleet.difficulty).toBe('medium')
  })

  it('generates scavenger fleets', () => {
    const fleet = generateOpponentFleet({
      questId: 'quest-1',
      opponentType: 'scavengers',
      difficulty: 'easy'
    })

    expect(fleet.factionId).toBe('scavengers')
    expect(fleet.name).toContain('Scavenger')
  })

  it('generates pirate fleets', () => {
    const fleet = generateOpponentFleet({
      questId: 'quest-1',
      opponentType: 'pirates',
      difficulty: 'medium'
    })

    expect(fleet.factionId).toBe('pirates')
    expect(fleet.name).toContain('Pirate')
  })

  it('generates faction fleets', () => {
    const factionTypes = ['ironveil', 'ashfall', 'meridian', 'void_wardens', 'sundered_oath'] as const

    for (const faction of factionTypes) {
      const fleet = generateOpponentFleet({
        questId: 'quest-1',
        opponentType: faction,
        difficulty: 'hard'
      })

      expect(fleet.factionId).toBe(faction)
      expect(fleet.cards).toHaveLength(5)
    }
  })

  it('applies difficulty modifiers', () => {
    // Generate multiple fleets at different difficulties and compare average stats
    const easyFleets = Array.from({ length: 10 }, () =>
      generateOpponentFleet({
        questId: 'quest-1',
        opponentType: 'scavengers',
        difficulty: 'easy'
      })
    )

    const hardFleets = Array.from({ length: 10 }, () =>
      generateOpponentFleet({
        questId: 'quest-1',
        opponentType: 'scavengers',
        difficulty: 'hard'
      })
    )

    const easyAvgStrength = easyFleets.reduce(
      (sum, f) => sum + calculateFleetStrength(f.cards), 0
    ) / easyFleets.length

    const hardAvgStrength = hardFleets.reduce(
      (sum, f) => sum + calculateFleetStrength(f.cards), 0
    ) / hardFleets.length

    // Hard fleets should be stronger on average
    expect(hardAvgStrength).toBeGreaterThan(easyAvgStrength)
  })

  it('falls back to scavengers for unknown opponent type', () => {
    const fleet = generateOpponentFleet({
      questId: 'quest-1',
      opponentType: 'unknown' as any,
      difficulty: 'medium'
    })

    expect(fleet.factionId).toBe('scavengers')
  })
})

describe('Adaptive Fleet Generation', () => {
  it('generates fleet scaled to player strength', () => {
    const playerStrength = 50  // Average fleet

    const easyFleet = generateAdaptiveFleet(
      {
        questId: 'quest-1',
        opponentType: 'scavengers',
        difficulty: 'easy'
      },
      playerStrength
    )

    const hardFleet = generateAdaptiveFleet(
      {
        questId: 'quest-1',
        opponentType: 'pirates',
        difficulty: 'hard'
      },
      playerStrength
    )

    const easyStrength = calculateFleetStrength(easyFleet.cards)
    const hardStrength = calculateFleetStrength(hardFleet.cards)

    // Easy should be weaker than player, hard should be stronger
    expect(easyStrength).toBeLessThan(playerStrength * 1.1)
    expect(hardStrength).toBeGreaterThan(playerStrength * 0.9)
  })
})

describe('Fleet Strength Calculation', () => {
  it('calculates total stats correctly', () => {
    const cards: Card[] = [
      { id: '1', name: 'A', faction: 'meridian', attack: 3, defense: 3, agility: 3, hull: 5, energyCost: 2, abilities: [] },
      { id: '2', name: 'B', faction: 'meridian', attack: 4, defense: 4, agility: 2, hull: 5, energyCost: 2, abilities: [] },
      { id: '3', name: 'C', faction: 'meridian', attack: 2, defense: 5, agility: 3, hull: 5, energyCost: 2, abilities: [] },
    ]

    const strength = calculateFleetStrength(cards)

    // Now includes hull: (3+3+3+5) + (4+4+2+5) + (2+5+3+5) = 14 + 15 + 15 = 44
    expect(strength).toBe(44)
  })

  it('returns 0 for empty fleet', () => {
    expect(calculateFleetStrength([])).toBe(0)
  })
})

describe('Fleet Templates', () => {
  it('returns all templates', () => {
    const templates = getFleetTemplates()

    expect(templates.length).toBeGreaterThan(0)
    expect(templates.some(t => t.factionId === 'scavengers')).toBe(true)
    expect(templates.some(t => t.factionId === 'pirates')).toBe(true)
    expect(templates.some(t => t.factionId === 'ironveil')).toBe(true)
  })

  it('each template has a card pool', () => {
    const templates = getFleetTemplates()

    for (const template of templates) {
      expect(template.cardPool.length).toBeGreaterThan(0)
    }
  })
})

describe('Card Pools', () => {
  it('returns scavenger card pool', () => {
    const pool = getCardPool('scavengers')
    expect(pool.length).toBeGreaterThan(0)
    expect(pool.every(c => c.id.startsWith('scav'))).toBe(true)
  })

  it('returns pirate card pool', () => {
    const pool = getCardPool('pirates')
    expect(pool.length).toBeGreaterThan(0)
    expect(pool.every(c => c.id.startsWith('pirate'))).toBe(true)
  })

  it('returns faction card pools', () => {
    const factions = ['ironveil', 'ashfall', 'meridian', 'void_wardens', 'sundered_oath'] as const

    for (const faction of factions) {
      const pool = getCardPool(faction)
      expect(pool.length).toBeGreaterThan(0)
    }
  })

  it('cards have valid stat ranges', () => {
    const pools = [
      getCardPool('scavengers'),
      getCardPool('pirates'),
      getCardPool('ironveil'),
      getCardPool('ashfall'),
    ]

    for (const pool of pools) {
      for (const card of pool) {
        expect(card.attack).toBeGreaterThanOrEqual(1)
        expect(card.attack).toBeLessThanOrEqual(7)
        // Defense can be 0 for glass cannon ships
        expect(card.defense).toBeGreaterThanOrEqual(0)
        expect(card.defense).toBeLessThanOrEqual(8)
        expect(card.agility).toBeGreaterThanOrEqual(1)
        expect(card.agility).toBeLessThanOrEqual(6)
      }
    }
  })
})

describe('Card Selection', () => {
  it('respects card uniqueness limit', () => {
    // Generate many fleets and check for excessive duplicates
    const fleets = Array.from({ length: 20 }, () =>
      generateOpponentFleet({
        questId: 'quest-1',
        opponentType: 'scavengers',
        difficulty: 'medium'
      })
    )

    for (const fleet of fleets) {
      // Count occurrences of each base card type (without index suffix)
      const cardCounts = new Map<string, number>()
      for (const card of fleet.cards) {
        // Extract base ID (e.g., "scav_rustbucket" from "scav_rustbucket_0")
        const baseId = card.id.replace(/_\d+$/, '')
        cardCounts.set(baseId, (cardCounts.get(baseId) || 0) + 1)
      }

      // No card type should appear more than 2 times
      for (const [cardType, count] of cardCounts) {
        expect(count).toBeLessThanOrEqual(2)
      }
    }
  })
})
