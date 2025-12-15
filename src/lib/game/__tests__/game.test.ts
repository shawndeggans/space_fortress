import { describe, it, expect } from 'vitest'
import { evolveState, getInitialState, rebuildState } from '../projections'
import { decide, InvalidCommandError } from '../decider'
import type { GameEvent } from '../events'
import type { GameCommand } from '../commands'
import type { GameState } from '../types'

describe('Event Projections', () => {
  it('returns initial state correctly', () => {
    const state = getInitialState()
    expect(state.gameStatus).toBe('not_started')
    expect(state.currentPhase).toBe('not_started')
    expect(state.bounty).toBe(0)
    expect(state.ownedCards).toEqual([])
    expect(state.reputation.ironveil).toBe(0)
    expect(state.reputation.ashfall).toBe(0)
  })

  it('handles GAME_STARTED event', () => {
    const state = getInitialState()
    const event: GameEvent = {
      type: 'GAME_STARTED',
      data: {
        timestamp: '2024-01-01T00:00:00Z',
        playerId: 'player-1',
        starterCardIds: ['card-1', 'card-2']
      }
    }
    const newState = evolveState(state, event)
    expect(newState.playerId).toBe('player-1')
    expect(newState.gameStatus).toBe('in_progress')
    expect(newState.startedAt).toBe('2024-01-01T00:00:00Z')
  })

  it('handles PHASE_CHANGED event', () => {
    const state: GameState = {
      ...getInitialState(),
      gameStatus: 'in_progress'
    }
    const event: GameEvent = {
      type: 'PHASE_CHANGED',
      data: {
        timestamp: '2024-01-01T00:00:00Z',
        fromPhase: 'not_started',
        toPhase: 'quest_hub'
      }
    }
    const newState = evolveState(state, event)
    expect(newState.currentPhase).toBe('quest_hub')
  })

  it('handles QUEST_ACCEPTED event', () => {
    const state: GameState = {
      ...getInitialState(),
      gameStatus: 'in_progress',
      availableQuestIds: ['quest-1', 'quest-2']
    }
    const event: GameEvent = {
      type: 'QUEST_ACCEPTED',
      data: {
        timestamp: '2024-01-01T00:00:00Z',
        questId: 'quest-1',
        factionId: 'ironveil',
        initialBounty: 500,
        initialCardIds: []
      }
    }
    const newState = evolveState(state, event)
    expect(newState.activeQuest).not.toBeNull()
    expect(newState.activeQuest?.questId).toBe('quest-1')
    expect(newState.bounty).toBe(500)
    expect(newState.availableQuestIds).not.toContain('quest-1')
  })

  it('handles REPUTATION_CHANGED event', () => {
    const state = getInitialState()
    const event: GameEvent = {
      type: 'REPUTATION_CHANGED',
      data: {
        timestamp: '2024-01-01T00:00:00Z',
        factionId: 'ironveil',
        delta: 25,
        newValue: 25,
        source: 'choice'
      }
    }
    const newState = evolveState(state, event)
    expect(newState.reputation.ironveil).toBe(25)
  })

  it('handles CARD_GAINED event', () => {
    const state = getInitialState()
    const event: GameEvent = {
      type: 'CARD_GAINED',
      data: {
        timestamp: '2024-01-01T00:00:00Z',
        cardId: 'ironveil_cruiser',
        factionId: 'ironveil',
        source: 'quest'
      }
    }
    const newState = evolveState(state, event)
    expect(newState.ownedCards).toHaveLength(1)
    expect(newState.ownedCards[0].id).toBe('ironveil_cruiser')
    expect(newState.stats.cardsAcquired).toBe(1)
  })

  it('handles CHOICE_MADE event', () => {
    const state: GameState = {
      ...getInitialState(),
      gameStatus: 'in_progress',
      activeQuest: {
        questId: 'quest-1',
        factionId: 'ironveil',
        currentDilemmaIndex: 0,
        dilemmasCompleted: 0,
        alliances: [],
        battlesWon: 0,
        battlesLost: 0
      }
    }
    const event: GameEvent = {
      type: 'CHOICE_MADE',
      data: {
        timestamp: '2024-01-01T00:00:00Z',
        dilemmaId: 'dilemma-1',
        choiceId: 'choice-a',
        questId: 'quest-1'
      }
    }
    const newState = evolveState(state, event)
    expect(newState.choiceHistory).toHaveLength(1)
    expect(newState.choiceHistory[0].choiceId).toBe('choice-a')
    expect(newState.stats.choicesMade).toBe(1)
  })

  it('handles BATTLE_TRIGGERED event', () => {
    const state: GameState = {
      ...getInitialState(),
      gameStatus: 'in_progress'
    }
    const event: GameEvent = {
      type: 'BATTLE_TRIGGERED',
      data: {
        timestamp: '2024-01-01T00:00:00Z',
        battleId: 'battle-1',
        questId: 'quest-1',
        context: 'Scavengers attack',
        opponentType: 'scavengers',
        opponentFactionId: 'scavengers',
        difficulty: 'medium'
      }
    }
    const newState = evolveState(state, event)
    expect(newState.currentBattle).not.toBeNull()
    expect(newState.currentBattle?.battleId).toBe('battle-1')
    expect(newState.currentBattle?.phase).toBe('selection')
  })

  it('handles CARD_SELECTED event', () => {
    const state: GameState = {
      ...getInitialState(),
      currentBattle: {
        battleId: 'battle-1',
        phase: 'selection',
        selectedCardIds: [],
        positions: [null, null, null, null, null],
        currentRound: 0,
        rounds: []
      }
    }
    const event: GameEvent = {
      type: 'CARD_SELECTED',
      data: {
        timestamp: '2024-01-01T00:00:00Z',
        cardId: 'card-1',
        battleId: 'battle-1'
      }
    }
    const newState = evolveState(state, event)
    expect(newState.currentBattle?.selectedCardIds).toContain('card-1')
  })

  it('handles BATTLE_RESOLVED event', () => {
    const state: GameState = {
      ...getInitialState(),
      gameStatus: 'in_progress',
      currentBattle: {
        battleId: 'battle-1',
        phase: 'execution',
        selectedCardIds: ['card-1'],
        positions: ['card-1', null, null, null, null],
        currentRound: 5,
        rounds: []
      },
      activeQuest: {
        questId: 'quest-1',
        factionId: 'ironveil',
        currentDilemmaIndex: 0,
        dilemmasCompleted: 0,
        alliances: [],
        battlesWon: 0,
        battlesLost: 0
      }
    }
    const event: GameEvent = {
      type: 'BATTLE_RESOLVED',
      data: {
        timestamp: '2024-01-01T00:00:00Z',
        battleId: 'battle-1',
        outcome: 'victory',
        playerWins: 3,
        opponentWins: 2,
        draws: 0,
        roundsSummary: []
      }
    }
    const newState = evolveState(state, event)
    expect(newState.currentBattle?.outcome).toBe('victory')
    expect(newState.stats.battlesWon).toBe(1)
    expect(newState.activeQuest?.battlesWon).toBe(1)
  })

  it('rebuilds identical state from events', () => {
    const events: GameEvent[] = [
      {
        type: 'GAME_STARTED',
        data: { timestamp: '2024-01-01T00:00:00Z', playerId: 'player-1', starterCardIds: [] }
      },
      {
        type: 'PHASE_CHANGED',
        data: { timestamp: '2024-01-01T00:00:01Z', fromPhase: 'not_started', toPhase: 'quest_hub' }
      },
      {
        type: 'QUESTS_GENERATED',
        data: { timestamp: '2024-01-01T00:00:01Z', questIds: ['quest-1', 'quest-2'] }
      },
      {
        type: 'REPUTATION_CHANGED',
        data: { timestamp: '2024-01-01T00:00:02Z', factionId: 'ironveil', delta: 25, newValue: 25, source: 'choice' }
      }
    ]

    const state1 = rebuildState(events)
    const state2 = rebuildState(events)

    expect(state1).toEqual(state2)
    expect(state1.reputation.ironveil).toBe(25)
    expect(state1.currentPhase).toBe('quest_hub')
  })
})

describe('Decider', () => {
  it('generates events from START_GAME command', () => {
    const state = getInitialState()
    const command: GameCommand = {
      type: 'START_GAME',
      data: { playerId: 'player-1' }
    }
    const events = decide(command, state)

    // Should generate: GAME_STARTED, PHASE_CHANGED, CARD_GAINED (x3), QUESTS_GENERATED
    expect(events.length).toBeGreaterThanOrEqual(5)
    expect(events[0].type).toBe('GAME_STARTED')
    expect(events[1].type).toBe('PHASE_CHANGED')

    const gameStarted = events.find(e => e.type === 'GAME_STARTED')
    expect(gameStarted).toBeDefined()
  })

  it('throws error if game already started', () => {
    const state: GameState = {
      ...getInitialState(),
      gameStatus: 'in_progress'
    }
    const command: GameCommand = {
      type: 'START_GAME',
      data: { playerId: 'player-1' }
    }
    expect(() => decide(command, state)).toThrow(InvalidCommandError)
  })

  it('handles ACCEPT_QUEST command', () => {
    const state: GameState = {
      ...getInitialState(),
      gameStatus: 'in_progress',
      currentPhase: 'quest_hub'
    }
    const command: GameCommand = {
      type: 'ACCEPT_QUEST',
      data: { questId: 'quest_salvage_claim' }
    }
    const events = decide(command, state)

    expect(events.length).toBeGreaterThanOrEqual(2)
    expect(events[0].type).toBe('QUEST_ACCEPTED')
    expect(events[1].type).toBe('PHASE_CHANGED')
  })

  it('throws error when accepting quest with active quest', () => {
    const state: GameState = {
      ...getInitialState(),
      gameStatus: 'in_progress',
      activeQuest: {
        questId: 'existing-quest',
        factionId: 'ironveil',
        currentDilemmaIndex: 0,
        dilemmasCompleted: 0,
        alliances: [],
        battlesWon: 0,
        battlesLost: 0
      }
    }
    const command: GameCommand = {
      type: 'ACCEPT_QUEST',
      data: { questId: 'quest-2' }
    }
    expect(() => decide(command, state)).toThrow(InvalidCommandError)
  })

  it('handles SELECT_CARD command', () => {
    const state: GameState = {
      ...getInitialState(),
      gameStatus: 'in_progress',
      currentPhase: 'card_selection',
      ownedCards: [{
        id: 'card-1',
        name: 'Test Card',
        faction: 'ironveil',
        attack: 3,
        armor: 3,
        agility: 3,
        source: 'starter',
        acquiredAt: '2024-01-01',
        isLocked: false
      }],
      currentBattle: {
        battleId: 'battle-1',
        phase: 'selection',
        selectedCardIds: [],
        positions: [null, null, null, null, null],
        currentRound: 0,
        rounds: []
      }
    }
    const command: GameCommand = {
      type: 'SELECT_CARD',
      data: { cardId: 'card-1' }
    }
    const events = decide(command, state)

    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('CARD_SELECTED')
  })

  it('throws error when selecting card not owned', () => {
    const state: GameState = {
      ...getInitialState(),
      gameStatus: 'in_progress',
      currentPhase: 'card_selection',
      ownedCards: [],
      currentBattle: {
        battleId: 'battle-1',
        phase: 'selection',
        selectedCardIds: [],
        positions: [null, null, null, null, null],
        currentRound: 0,
        rounds: []
      }
    }
    const command: GameCommand = {
      type: 'SELECT_CARD',
      data: { cardId: 'nonexistent-card' }
    }
    expect(() => decide(command, state)).toThrow(InvalidCommandError)
  })

  it('handles FORM_ALLIANCE command', () => {
    const state: GameState = {
      ...getInitialState(),
      gameStatus: 'in_progress',
      currentPhase: 'alliance',
      activeQuest: {
        questId: 'test-quest',
        factionId: 'ironveil',
        currentDilemmaIndex: 0,
        dilemmasCompleted: 0,
        alliances: [],
        battlesWon: 0,
        battlesLost: 0
      },
      reputation: {
        ...getInitialState().reputation,
        ironveil: 30  // Friendly status
      }
    }
    const command: GameCommand = {
      type: 'FORM_ALLIANCE',
      data: { factionId: 'ironveil' }
    }
    const events = decide(command, state)

    expect(events.length).toBeGreaterThanOrEqual(1)
    expect(events[0].type).toBe('ALLIANCE_FORMED')
    // Should emit CARD_GAINED events for alliance cards
    expect(events.some(e => e.type === 'CARD_GAINED')).toBe(true)
    // Should NOT trigger battle - use FINALIZE_ALLIANCES for that
    expect(events.some(e => e.type === 'BATTLE_TRIGGERED')).toBe(false)
    // Should stay in alliance phase (no PHASE_CHANGED event)
    expect(events.some(e => e.type === 'PHASE_CHANGED')).toBe(false)
  })

  it('throws error when forming alliance with hostile faction', () => {
    const state: GameState = {
      ...getInitialState(),
      gameStatus: 'in_progress',
      currentPhase: 'alliance',
      reputation: {
        ...getInitialState().reputation,
        ironveil: -80  // Hostile status
      }
    }
    const command: GameCommand = {
      type: 'FORM_ALLIANCE',
      data: { factionId: 'ironveil' }
    }
    expect(() => decide(command, state)).toThrow(InvalidCommandError)
  })
})
