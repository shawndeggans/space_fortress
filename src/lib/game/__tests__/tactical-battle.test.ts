// ============================================================================
// SPACE FORTRESS - Tactical Battle Tests
// ============================================================================
//
// Tests for the turn-based tactical battle system.
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { decide, InvalidCommandError } from '../decider'
import { evolveState, getInitialState, rebuildState } from '../projections'
import type { GameState, GameEvent } from '../types'
import { TACTICAL_BATTLE_CONFIG } from '../types'

// ----------------------------------------------------------------------------
// Test Helpers
// ----------------------------------------------------------------------------

function buildState(events: GameEvent[]): GameState {
  return events.reduce(evolveState, getInitialState())
}

function timestamp(): string {
  return new Date().toISOString()
}

function createGameInCardSelection(): GameState {
  const ts = timestamp()
  const events: GameEvent[] = [
    {
      type: 'GAME_STARTED',
      data: { timestamp: ts, playerId: 'test-player', starterCardIds: ['starter_scout', 'starter_freighter', 'starter_corvette'] }
    },
    {
      type: 'CARD_GAINED',
      data: { timestamp: ts, cardId: 'starter_scout', factionId: 'ironveil', source: 'starter', name: 'Scout', attack: 2, defense: 1, hull: 2, agility: 3, energyCost: 1 }
    },
    {
      type: 'CARD_GAINED',
      data: { timestamp: ts, cardId: 'starter_freighter', factionId: 'meridian', source: 'starter', name: 'Freighter', attack: 1, defense: 2, hull: 4, agility: 1, energyCost: 2 }
    },
    {
      type: 'CARD_GAINED',
      data: { timestamp: ts, cardId: 'starter_corvette', factionId: 'ashfall', source: 'starter', name: 'Corvette', attack: 3, defense: 2, hull: 3, agility: 2, energyCost: 2 }
    },
    // Add more cards to meet deck size requirements
    {
      type: 'CARD_GAINED',
      data: { timestamp: ts, cardId: 'test_card_4', factionId: 'ironveil', source: 'quest', name: 'Test 4', attack: 2, defense: 2, hull: 3, agility: 2, energyCost: 2 }
    },
    {
      type: 'CARD_GAINED',
      data: { timestamp: ts, cardId: 'test_card_5', factionId: 'ironveil', source: 'quest', name: 'Test 5', attack: 3, defense: 1, hull: 2, agility: 3, energyCost: 1 }
    },
    {
      type: 'CARD_GAINED',
      data: { timestamp: ts, cardId: 'test_card_6', factionId: 'meridian', source: 'quest', name: 'Test 6', attack: 2, defense: 3, hull: 4, agility: 1, energyCost: 3 }
    },
    {
      type: 'CARD_GAINED',
      data: { timestamp: ts, cardId: 'test_card_7', factionId: 'ashfall', source: 'quest', name: 'Test 7', attack: 4, defense: 1, hull: 2, agility: 4, energyCost: 2 }
    },
    {
      type: 'CARD_GAINED',
      data: { timestamp: ts, cardId: 'test_card_8', factionId: 'void_wardens', source: 'quest', name: 'Test 8', attack: 2, defense: 4, hull: 5, agility: 1, energyCost: 3 }
    },
    {
      type: 'PHASE_CHANGED',
      data: { timestamp: ts, fromPhase: 'not_started', toPhase: 'quest_hub' }
    },
    {
      type: 'QUEST_ACCEPTED',
      data: { timestamp: ts, questId: 'quest_salvage_claim', factionId: 'ironveil', initialBounty: 100, initialCardIds: [] }
    },
    {
      type: 'PHASE_CHANGED',
      data: { timestamp: ts, fromPhase: 'quest_hub', toPhase: 'card_selection' }
    },
    {
      type: 'BATTLE_TRIGGERED',
      data: {
        timestamp: ts,
        battleId: 'battle_1',
        questId: 'quest_salvage_claim',
        context: 'Test battle',
        opponentType: 'enemy_forces',
        opponentFactionId: 'scavengers',
        difficulty: 'medium'
      }
    }
  ]
  return buildState(events)
}

// ----------------------------------------------------------------------------
// START_TACTICAL_BATTLE Tests
// ----------------------------------------------------------------------------

describe('START_TACTICAL_BATTLE command', () => {
  it('starts a tactical battle with valid deck', () => {
    const state = createGameInCardSelection()
    const deckCardIds = [
      'starter_scout',
      'starter_freighter',
      'starter_corvette',
      'test_card_4',
      'test_card_5',
      'test_card_6',
      'test_card_7',
      'test_card_8'
    ]

    const events = decide(
      { type: 'START_TACTICAL_BATTLE', data: { deckCardIds } },
      state
    )

    // Should emit TACTICAL_BATTLE_STARTED event
    const startedEvent = events.find(e => e.type === 'TACTICAL_BATTLE_STARTED')
    expect(startedEvent).toBeDefined()
    expect(startedEvent?.data.playerDeckCardIds).toEqual(deckCardIds)
    expect(startedEvent?.data.difficulty).toBe('medium')
    expect(startedEvent?.data.opponentFactionId).toBe('scavengers')

    // Should draw starting hands
    const drawEvents = events.filter(e => e.type === 'TACTICAL_CARD_DRAWN')
    expect(drawEvents.length).toBe(TACTICAL_BATTLE_CONFIG.startingHandSize * 2)
  })

  it('rejects deck with fewer than minimum cards', () => {
    const state = createGameInCardSelection()
    const deckCardIds = ['starter_scout', 'starter_freighter'] // Only 2 cards

    expect(() =>
      decide({ type: 'START_TACTICAL_BATTLE', data: { deckCardIds } }, state)
    ).toThrow(InvalidCommandError)
  })

  it('rejects deck with more than maximum cards', () => {
    const state = createGameInCardSelection()
    const deckCardIds = Array(15).fill('starter_scout') // 15 cards

    expect(() =>
      decide({ type: 'START_TACTICAL_BATTLE', data: { deckCardIds } }, state)
    ).toThrow(InvalidCommandError)
  })

  it('rejects cards not owned by player', () => {
    const state = createGameInCardSelection()
    const deckCardIds = [
      'starter_scout',
      'starter_freighter',
      'starter_corvette',
      'test_card_4',
      'test_card_5',
      'test_card_6',
      'test_card_7',
      'not_owned_card' // This card is not owned
    ]

    expect(() =>
      decide({ type: 'START_TACTICAL_BATTLE', data: { deckCardIds } }, state)
    ).toThrow(InvalidCommandError)
  })

  it('rejects command when not in card_selection phase', () => {
    const state = getInitialState()
    const deckCardIds = ['starter_scout']

    expect(() =>
      decide({ type: 'START_TACTICAL_BATTLE', data: { deckCardIds } }, state)
    ).toThrow(InvalidCommandError)
  })
})

// ----------------------------------------------------------------------------
// Mulligan Tests
// ----------------------------------------------------------------------------

describe('SKIP_MULLIGAN command', () => {
  it('skips mulligan and starts first turn', () => {
    // Create a state with tactical battle in mulligan phase
    const baseState = createGameInCardSelection()
    const deckCardIds = [
      'starter_scout',
      'starter_freighter',
      'starter_corvette',
      'test_card_4',
      'test_card_5',
      'test_card_6',
      'test_card_7',
      'test_card_8'
    ]

    const startEvents = decide(
      { type: 'START_TACTICAL_BATTLE', data: { deckCardIds } },
      baseState
    )
    const battleState = rebuildState([...getGameEvents(baseState), ...startEvents])

    const events = decide({ type: 'SKIP_MULLIGAN', data: {} }, battleState)

    // Should emit mulligan completed
    const mulliganEvent = events.find(e => e.type === 'MULLIGAN_COMPLETED')
    expect(mulliganEvent).toBeDefined()
    expect(mulliganEvent?.data.cardsRedrawn).toBe(0)

    // Should start first turn
    const turnStartEvent = events.find(e => e.type === 'TACTICAL_TURN_STARTED')
    expect(turnStartEvent).toBeDefined()
    expect(turnStartEvent?.data.turnNumber).toBe(1)
  })
})

// ----------------------------------------------------------------------------
// Helper to get events from state (mock)
// ----------------------------------------------------------------------------

function getGameEvents(state: GameState): GameEvent[] {
  // For testing, we rebuild the events that created this state
  // In a real implementation, events would be stored
  const ts = timestamp()
  return [
    {
      type: 'GAME_STARTED',
      data: { timestamp: ts, playerId: state.playerId, starterCardIds: [] }
    },
    {
      type: 'PHASE_CHANGED',
      data: { timestamp: ts, fromPhase: 'not_started', toPhase: state.currentPhase }
    }
  ]
}

// ----------------------------------------------------------------------------
// Configuration Tests
// ----------------------------------------------------------------------------

describe('TACTICAL_BATTLE_CONFIG', () => {
  it('has valid energy settings', () => {
    expect(TACTICAL_BATTLE_CONFIG.startingMaxEnergy).toBe(3)
    expect(TACTICAL_BATTLE_CONFIG.energyRegeneration).toBe(2)
    expect(TACTICAL_BATTLE_CONFIG.secondPlayerExtraEnergy).toBe(1)
    expect(TACTICAL_BATTLE_CONFIG.drawCardCost).toBe(2)
  })

  it('has valid hand settings', () => {
    expect(TACTICAL_BATTLE_CONFIG.startingHandSize).toBe(4)
    expect(TACTICAL_BATTLE_CONFIG.maxHandSize).toBe(5)
    expect(TACTICAL_BATTLE_CONFIG.deckSize.min).toBe(8)
    expect(TACTICAL_BATTLE_CONFIG.deckSize.max).toBe(10)
  })

  it('has valid battlefield settings', () => {
    expect(TACTICAL_BATTLE_CONFIG.battlefieldSlots).toBe(5)
    expect(TACTICAL_BATTLE_CONFIG.moveCost).toBe(1)
  })

  it('has valid victory settings', () => {
    expect(TACTICAL_BATTLE_CONFIG.roundLimit).toBe(5)
    expect(TACTICAL_BATTLE_CONFIG.baseFlagshipHull).toBe(10)
    expect(TACTICAL_BATTLE_CONFIG.flagshipHullPerDifficulty).toBe(2)
  })
})

// ----------------------------------------------------------------------------
// Projection Tests
// ----------------------------------------------------------------------------

describe('Tactical Battle Projections', () => {
  it('creates initial tactical battle state from TACTICAL_BATTLE_STARTED', () => {
    const ts = timestamp()
    const state = getInitialState()

    const event: GameEvent = {
      type: 'TACTICAL_BATTLE_STARTED',
      data: {
        timestamp: ts,
        battleId: 'test-battle',
        questId: 'test-quest',
        context: 'Test battle',
        playerDeckCardIds: ['card1', 'card2'],
        opponentDeckCardIds: ['enemy1', 'enemy2'],
        opponentName: 'Test Enemy',
        opponentFactionId: 'scavengers',
        difficulty: 'medium',
        playerFlagshipHull: 10,
        opponentFlagshipHull: 12,
        firstPlayer: 'player',
        initiativeReason: 'agility'
      }
    }

    const newState = evolveState(state, event)

    expect(newState.currentPhase).toBe('tactical_battle')
    expect(newState.currentTacticalBattle).not.toBeNull()
    expect(newState.currentTacticalBattle?.battleId).toBe('test-battle')
    expect(newState.currentTacticalBattle?.phase).toBe('mulligan')
    expect(newState.currentTacticalBattle?.player.flagship.currentHull).toBe(10)
    expect(newState.currentTacticalBattle?.opponent.flagship.currentHull).toBe(12)
    expect(newState.currentTacticalBattle?.initiative.firstPlayer).toBe('player')
  })

  it('updates energy on ENERGY_SPENT', () => {
    const ts = timestamp()
    let state = getInitialState()

    // First create a tactical battle
    state = evolveState(state, {
      type: 'TACTICAL_BATTLE_STARTED',
      data: {
        timestamp: ts,
        battleId: 'test-battle',
        questId: 'test-quest',
        context: 'Test',
        playerDeckCardIds: [],
        opponentDeckCardIds: [],
        opponentName: 'Test',
        opponentFactionId: 'scavengers',
        difficulty: 'medium',
        playerFlagshipHull: 10,
        opponentFlagshipHull: 10,
        firstPlayer: 'player',
        initiativeReason: 'agility'
      }
    })

    // Set initial energy
    expect(state.currentTacticalBattle?.player.energy.current).toBe(3)

    // Spend energy
    state = evolveState(state, {
      type: 'ENERGY_SPENT',
      data: {
        timestamp: ts,
        battleId: 'test-battle',
        player: 'player',
        amount: 2,
        newTotal: 1,
        action: 'deploy'
      }
    })

    expect(state.currentTacticalBattle?.player.energy.current).toBe(1)
  })

  it('resolves battle and updates stats on TACTICAL_BATTLE_RESOLVED', () => {
    const ts = timestamp()
    let state = getInitialState()
    state = evolveState(state, {
      type: 'GAME_STARTED',
      data: { timestamp: ts, playerId: 'test', starterCardIds: [] }
    })
    state = evolveState(state, {
      type: 'QUEST_ACCEPTED',
      data: { timestamp: ts, questId: 'q1', factionId: 'ironveil', initialBounty: 100, initialCardIds: [] }
    })

    // Create tactical battle
    state = evolveState(state, {
      type: 'TACTICAL_BATTLE_STARTED',
      data: {
        timestamp: ts,
        battleId: 'test-battle',
        questId: 'q1',
        context: 'Test',
        playerDeckCardIds: [],
        opponentDeckCardIds: [],
        opponentName: 'Test',
        opponentFactionId: 'scavengers',
        difficulty: 'medium',
        playerFlagshipHull: 10,
        opponentFlagshipHull: 10,
        firstPlayer: 'player',
        initiativeReason: 'agility'
      }
    })

    const prevBattlesWon = state.stats.battlesWon

    // Resolve battle with victory
    state = evolveState(state, {
      type: 'TACTICAL_BATTLE_RESOLVED',
      data: {
        timestamp: ts,
        battleId: 'test-battle',
        winner: 'player',
        victoryCondition: 'flagship_destroyed',
        turnsPlayed: 5,
        playerFinalHull: 8,
        opponentFinalHull: 0,
        playerShipsDestroyed: 1,
        opponentShipsDestroyed: 3
      }
    })

    expect(state.currentTacticalBattle?.phase).toBe('resolved')
    expect(state.currentTacticalBattle?.winner).toBe('player')
    expect(state.stats.battlesWon).toBe(prevBattlesWon + 1)
    expect(state.activeQuest?.battlesWon).toBe(1)
  })
})
