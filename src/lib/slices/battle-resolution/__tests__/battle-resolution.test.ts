// ============================================================================
// BATTLE-RESOLUTION SLICE - Tests
// ============================================================================
//
// Tests for the battle-resolution read model projection.
// Uses Given-When-Then pattern.
// ============================================================================

import { describe, it, expect } from 'vitest'
import type { GameEvent } from '../../../game/events'
import type { Card } from '../../../game/types'
import {
  createBattleProjection,
  buildBattleView,
  projectBattleFromEvents,
  TOTAL_ROUNDS
} from '../read-model'

// ----------------------------------------------------------------------------
// Test Helpers
// ----------------------------------------------------------------------------

function timestamp(): string {
  return new Date().toISOString()
}

function createCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'card-1',
    name: 'Test Card',
    faction: 'ironveil',
    attack: 3,
    armor: 2,
    agility: 4,
    ...overrides
  }
}

function createBattleTriggeredEvent(battleId = 'battle-1'): GameEvent {
  return {
    type: 'BATTLE_TRIGGERED',
    data: {
      timestamp: timestamp(),
      battleId,
      questId: 'quest-1',
      context: 'Test battle context',
      opponentType: 'scavengers',
      opponentFactionId: 'scavengers',
      difficulty: 'medium'
    }
  }
}

function createRoundStartedEvent(battleId: string, roundNumber: number): GameEvent {
  return {
    type: 'ROUND_STARTED',
    data: {
      timestamp: timestamp(),
      battleId,
      roundNumber
    }
  }
}

function createInitiativeResolvedEvent(
  battleId: string,
  roundNumber: number,
  firstStriker: 'player' | 'opponent' | 'simultaneous'
): GameEvent {
  return {
    type: 'INITIATIVE_RESOLVED',
    data: {
      timestamp: timestamp(),
      battleId,
      roundNumber,
      firstStriker,
      playerAgility: 4,
      opponentAgility: 3
    }
  }
}

function createRoundResolvedEvent(
  battleId: string,
  roundNumber: number,
  outcome: 'player_won' | 'opponent_won' | 'draw',
  playerCard: Card = createCard({ id: 'player-card', name: 'Player Card' }),
  opponentCard: Card = createCard({ id: 'opponent-card', name: 'Opponent Card', faction: 'ashfall' })
): GameEvent {
  return {
    type: 'ROUND_RESOLVED',
    data: {
      timestamp: timestamp(),
      battleId,
      roundNumber,
      outcome,
      playerCard,
      opponentCard,
      playerRoll: { base: 15, modifier: 3, total: 18, hit: outcome !== 'opponent_won' },
      opponentRoll: { base: 10, modifier: 2, total: 12, hit: outcome === 'opponent_won' || outcome === 'draw' }
    }
  }
}

function createBattleResolvedEvent(
  battleId: string,
  outcome: 'victory' | 'defeat' | 'draw',
  playerWins: number,
  opponentWins: number,
  draws: number
): GameEvent {
  return {
    type: 'BATTLE_RESOLVED',
    data: {
      timestamp: timestamp(),
      battleId,
      outcome,
      playerWins,
      opponentWins,
      draws,
      roundsSummary: []
    }
  }
}

// ----------------------------------------------------------------------------
// Read Model Tests
// ----------------------------------------------------------------------------

describe('Battle Resolution Read Model', () => {
  describe('Projection', () => {
    it('returns null when no battle events', () => {
      // Given: no events
      const events: GameEvent[] = []

      // When: projecting battle view
      const view = projectBattleFromEvents(events)

      // Then: returns null
      expect(view).toBeNull()
    })

    it('initializes battle view from BATTLE_TRIGGERED', () => {
      // Given: a battle triggered event
      const events: GameEvent[] = [
        createBattleTriggeredEvent('battle-123')
      ]

      // When: projecting battle view
      const view = projectBattleFromEvents(events)

      // Then: battle is initialized
      expect(view).not.toBeNull()
      expect(view!.battleId).toBe('battle-123')
      expect(view!.battleContext).toBe('Test battle context')
      expect(view!.opponentName).toBe('Scavengers Fleet')
      expect(view!.currentRound).toBe(0)
      expect(view!.phase).toBe('in_progress')
      expect(view!.playerWins).toBe(0)
      expect(view!.opponentWins).toBe(0)
      expect(view!.draws).toBe(0)
      expect(view!.completedRounds).toHaveLength(0)
    })

    it('updates current round from ROUND_STARTED', () => {
      // Given: battle triggered and round started
      const events: GameEvent[] = [
        createBattleTriggeredEvent('battle-1'),
        createRoundStartedEvent('battle-1', 1)
      ]

      // When: projecting battle view
      const view = projectBattleFromEvents(events)

      // Then: current round is updated
      expect(view!.currentRound).toBe(1)
    })

    it('tracks initiative from INITIATIVE_RESOLVED', () => {
      // Given: battle with initiative resolved
      const events: GameEvent[] = [
        createBattleTriggeredEvent('battle-1'),
        createRoundStartedEvent('battle-1', 1),
        createInitiativeResolvedEvent('battle-1', 1, 'player'),
        createRoundResolvedEvent('battle-1', 1, 'player_won')
      ]

      // When: projecting battle view
      const view = projectBattleFromEvents(events)

      // Then: round shows player initiative
      expect(view!.completedRounds[0].initiative).toBe('player')
    })

    it('adds completed round from ROUND_RESOLVED', () => {
      // Given: battle with one round completed
      const playerCard = createCard({ id: 'p1', name: 'Iron Guardian', attack: 4, armor: 3, agility: 2 })
      const opponentCard = createCard({ id: 'o1', name: 'Scavenger Raider', faction: 'ashfall', attack: 2, armor: 1, agility: 3 })

      const events: GameEvent[] = [
        createBattleTriggeredEvent('battle-1'),
        createRoundStartedEvent('battle-1', 1),
        createInitiativeResolvedEvent('battle-1', 1, 'opponent'),
        createRoundResolvedEvent('battle-1', 1, 'player_won', playerCard, opponentCard)
      ]

      // When: projecting battle view
      const view = projectBattleFromEvents(events)

      // Then: round is in completed rounds
      expect(view!.completedRounds).toHaveLength(1)
      const round = view!.completedRounds[0]
      expect(round.roundNumber).toBe(1)
      expect(round.outcome).toBe('player_won')
      expect(round.outcomeLabel).toBe('WON')
      expect(round.playerCard.name).toBe('Iron Guardian')
      expect(round.opponentCard.name).toBe('Scavenger Raider')
      expect(round.initiative).toBe('opponent')
    })

    it('calculates target numbers from armor', () => {
      // Given: cards with specific armor values
      const playerCard = createCard({ armor: 5 })
      const opponentCard = createCard({ armor: 3, faction: 'ashfall' })

      const events: GameEvent[] = [
        createBattleTriggeredEvent('battle-1'),
        createRoundResolvedEvent('battle-1', 1, 'player_won', playerCard, opponentCard)
      ]

      // When: projecting battle view
      const view = projectBattleFromEvents(events)

      // Then: target numbers are 10 + armor
      const round = view!.completedRounds[0]
      expect(round.playerRoll.targetNumber).toBe(13) // 10 + opponent armor (3)
      expect(round.playerRoll.targetArmor).toBe(3)
      expect(round.opponentRoll.targetNumber).toBe(15) // 10 + player armor (5)
      expect(round.opponentRoll.targetArmor).toBe(5)
    })

    it('sets final outcome from BATTLE_RESOLVED', () => {
      // Given: completed battle
      const events: GameEvent[] = [
        createBattleTriggeredEvent('battle-1'),
        createBattleResolvedEvent('battle-1', 'victory', 3, 1, 1)
      ]

      // When: projecting battle view
      const view = projectBattleFromEvents(events)

      // Then: final outcome is set
      expect(view!.finalOutcome).toBe('victory')
      expect(view!.outcomeLabel).toBe('VICTORY')
      expect(view!.phase).toBe('complete')
    })
  })

  describe('Score Calculation', () => {
    it('counts player wins correctly', () => {
      // Given: battle with 3 player wins
      const events: GameEvent[] = [
        createBattleTriggeredEvent('battle-1'),
        createRoundResolvedEvent('battle-1', 1, 'player_won'),
        createRoundResolvedEvent('battle-1', 2, 'player_won'),
        createRoundResolvedEvent('battle-1', 3, 'player_won')
      ]

      // When: projecting battle view
      const view = projectBattleFromEvents(events)

      // Then: player wins is 3
      expect(view!.playerWins).toBe(3)
      expect(view!.opponentWins).toBe(0)
      expect(view!.draws).toBe(0)
    })

    it('counts opponent wins correctly', () => {
      // Given: battle with 2 opponent wins
      const events: GameEvent[] = [
        createBattleTriggeredEvent('battle-1'),
        createRoundResolvedEvent('battle-1', 1, 'opponent_won'),
        createRoundResolvedEvent('battle-1', 2, 'opponent_won')
      ]

      // When: projecting battle view
      const view = projectBattleFromEvents(events)

      // Then: opponent wins is 2
      expect(view!.playerWins).toBe(0)
      expect(view!.opponentWins).toBe(2)
      expect(view!.draws).toBe(0)
    })

    it('counts draws correctly', () => {
      // Given: battle with 2 draws
      const events: GameEvent[] = [
        createBattleTriggeredEvent('battle-1'),
        createRoundResolvedEvent('battle-1', 1, 'draw'),
        createRoundResolvedEvent('battle-1', 2, 'draw')
      ]

      // When: projecting battle view
      const view = projectBattleFromEvents(events)

      // Then: draws is 2
      expect(view!.playerWins).toBe(0)
      expect(view!.opponentWins).toBe(0)
      expect(view!.draws).toBe(2)
    })

    it('counts mixed outcomes correctly', () => {
      // Given: battle with mixed results
      const events: GameEvent[] = [
        createBattleTriggeredEvent('battle-1'),
        createRoundResolvedEvent('battle-1', 1, 'player_won'),
        createRoundResolvedEvent('battle-1', 2, 'opponent_won'),
        createRoundResolvedEvent('battle-1', 3, 'draw'),
        createRoundResolvedEvent('battle-1', 4, 'player_won'),
        createRoundResolvedEvent('battle-1', 5, 'opponent_won')
      ]

      // When: projecting battle view
      const view = projectBattleFromEvents(events)

      // Then: all counts are correct
      expect(view!.playerWins).toBe(2)
      expect(view!.opponentWins).toBe(2)
      expect(view!.draws).toBe(1)
    })
  })

  describe('Phase Detection', () => {
    it('shows in_progress before all rounds complete', () => {
      // Given: battle with 3 rounds
      const events: GameEvent[] = [
        createBattleTriggeredEvent('battle-1'),
        createRoundResolvedEvent('battle-1', 1, 'player_won'),
        createRoundResolvedEvent('battle-1', 2, 'player_won'),
        createRoundResolvedEvent('battle-1', 3, 'player_won')
      ]

      // When: projecting battle view
      const view = projectBattleFromEvents(events)

      // Then: phase is in_progress
      expect(view!.phase).toBe('in_progress')
      expect(view!.completedRounds.length).toBeLessThan(TOTAL_ROUNDS)
    })

    it('shows complete after all rounds', () => {
      // Given: battle with all 5 rounds
      const events: GameEvent[] = [
        createBattleTriggeredEvent('battle-1'),
        createRoundResolvedEvent('battle-1', 1, 'player_won'),
        createRoundResolvedEvent('battle-1', 2, 'player_won'),
        createRoundResolvedEvent('battle-1', 3, 'player_won'),
        createRoundResolvedEvent('battle-1', 4, 'opponent_won'),
        createRoundResolvedEvent('battle-1', 5, 'opponent_won')
      ]

      // When: projecting battle view
      const view = projectBattleFromEvents(events)

      // Then: phase is complete
      expect(view!.phase).toBe('complete')
      expect(view!.completedRounds.length).toBe(TOTAL_ROUNDS)
    })

    it('shows complete when BATTLE_RESOLVED received', () => {
      // Given: battle resolved event
      const events: GameEvent[] = [
        createBattleTriggeredEvent('battle-1'),
        createBattleResolvedEvent('battle-1', 'defeat', 1, 3, 1)
      ]

      // When: projecting battle view
      const view = projectBattleFromEvents(events)

      // Then: phase is complete
      expect(view!.phase).toBe('complete')
    })
  })

  describe('Outcome Labels', () => {
    it('shows WON for player_won rounds', () => {
      const events: GameEvent[] = [
        createBattleTriggeredEvent('battle-1'),
        createRoundResolvedEvent('battle-1', 1, 'player_won')
      ]

      const view = projectBattleFromEvents(events)
      expect(view!.completedRounds[0].outcomeLabel).toBe('WON')
    })

    it('shows LOST for opponent_won rounds', () => {
      const events: GameEvent[] = [
        createBattleTriggeredEvent('battle-1'),
        createRoundResolvedEvent('battle-1', 1, 'opponent_won')
      ]

      const view = projectBattleFromEvents(events)
      expect(view!.completedRounds[0].outcomeLabel).toBe('LOST')
    })

    it('shows DRAW for draw rounds', () => {
      const events: GameEvent[] = [
        createBattleTriggeredEvent('battle-1'),
        createRoundResolvedEvent('battle-1', 1, 'draw')
      ]

      const view = projectBattleFromEvents(events)
      expect(view!.completedRounds[0].outcomeLabel).toBe('DRAW')
    })

    it('shows VICTORY for victory outcome', () => {
      const events: GameEvent[] = [
        createBattleTriggeredEvent('battle-1'),
        createBattleResolvedEvent('battle-1', 'victory', 3, 2, 0)
      ]

      const view = projectBattleFromEvents(events)
      expect(view!.outcomeLabel).toBe('VICTORY')
    })

    it('shows DEFEAT for defeat outcome', () => {
      const events: GameEvent[] = [
        createBattleTriggeredEvent('battle-1'),
        createBattleResolvedEvent('battle-1', 'defeat', 1, 4, 0)
      ]

      const view = projectBattleFromEvents(events)
      expect(view!.outcomeLabel).toBe('DEFEAT')
    })

    it('shows DRAW for draw battle outcome', () => {
      const events: GameEvent[] = [
        createBattleTriggeredEvent('battle-1'),
        createBattleResolvedEvent('battle-1', 'draw', 2, 2, 1)
      ]

      const view = projectBattleFromEvents(events)
      expect(view!.outcomeLabel).toBe('DRAW')
    })
  })

  describe('Battle Isolation', () => {
    it('ignores events from different battles', () => {
      // Given: events from different battles
      const events: GameEvent[] = [
        createBattleTriggeredEvent('battle-1'),
        createRoundResolvedEvent('battle-2', 1, 'player_won'), // Different battle
        createRoundResolvedEvent('battle-1', 1, 'opponent_won')
      ]

      // When: projecting battle view
      const view = projectBattleFromEvents(events)

      // Then: only battle-1 events are counted
      expect(view!.battleId).toBe('battle-1')
      expect(view!.completedRounds).toHaveLength(1)
      expect(view!.completedRounds[0].outcome).toBe('opponent_won')
      expect(view!.opponentWins).toBe(1)
      expect(view!.playerWins).toBe(0)
    })
  })

  describe('Card View', () => {
    it('builds card view with faction icon', () => {
      // Given: battle with Ironveil card
      const playerCard = createCard({ faction: 'ironveil' })
      const events: GameEvent[] = [
        createBattleTriggeredEvent('battle-1'),
        createRoundResolvedEvent('battle-1', 1, 'player_won', playerCard, createCard({ faction: 'ashfall' }))
      ]

      // When: projecting battle view
      const view = projectBattleFromEvents(events)

      // Then: card has faction icon
      expect(view!.completedRounds[0].playerCard.factionIcon).toBe('▣')
    })

    it('maps all card stats correctly', () => {
      // Given: card with specific stats
      const playerCard = createCard({
        id: 'special-card',
        name: 'Special Card',
        attack: 5,
        armor: 4,
        agility: 3
      })
      const events: GameEvent[] = [
        createBattleTriggeredEvent('battle-1'),
        createRoundResolvedEvent('battle-1', 1, 'player_won', playerCard, createCard())
      ]

      // When: projecting battle view
      const view = projectBattleFromEvents(events)

      // Then: all stats are mapped
      const cardView = view!.completedRounds[0].playerCard
      expect(cardView.id).toBe('special-card')
      expect(cardView.name).toBe('Special Card')
      expect(cardView.attack).toBe(5)
      expect(cardView.armor).toBe(4)
      expect(cardView.agility).toBe(3)
    })
  })

  describe('Constants', () => {
    it('exports TOTAL_ROUNDS as 5', () => {
      expect(TOTAL_ROUNDS).toBe(5)
    })

    it('view includes totalRounds', () => {
      const events: GameEvent[] = [
        createBattleTriggeredEvent('battle-1')
      ]

      const view = projectBattleFromEvents(events)
      expect(view!.totalRounds).toBe(5)
    })
  })
})
