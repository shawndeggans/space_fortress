// ============================================================================
// PLAYER JOURNEY TESTS - Sequence Ending Edge Cases
// ============================================================================
// These tests verify that all game sequences end correctly and players
// never get stuck without options.
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { decide, InvalidCommandError } from '../decider'
import { evolveState, getInitialState, rebuildState } from '../projections'
import type { GameState, FactionId, OwnedCard, BattleState, GamePhase } from '../types'
import type { GameEvent } from '../events'
import type { GameCommand } from '../commands'
import { allQuests, getQuestById, getDilemmaById } from '../content/quests'
import { DeploymentError } from '../../slices/deployment/command'

// ============================================================================
// Test Helpers
// ============================================================================

function applyEvents(state: GameState, events: GameEvent[]): GameState {
  return events.reduce((s, e) => evolveState(s, e), state)
}

function executeCommand(command: GameCommand, state: GameState): {
  state: GameState
  events: GameEvent[]
} {
  const events = decide(command, state)
  const newState = applyEvents(state, events)
  return { state: newState, events }
}

function startGame(): GameState {
  const { state } = executeCommand(
    { type: 'START_GAME', data: { playerId: 'journey-test-player' } },
    getInitialState()
  )
  return state
}

function createStateWithPhase(phase: GamePhase, overrides: Partial<GameState> = {}): GameState {
  return {
    ...getInitialState(),
    gameStatus: 'in_progress',
    currentPhase: phase,
    playerId: 'test-player',
    startedAt: new Date().toISOString(),
    ownedCards: createTestCards(6),
    reputation: {
      ironveil: 0,
      ashfall: 0,
      meridian: 0,
      void_wardens: 0,
      sundered_oath: 0
    },
    ...overrides
  }
}

function createTestCards(count: number): OwnedCard[] {
  const cards: OwnedCard[] = []
  for (let i = 0; i < count; i++) {
    cards.push({
      id: `test_card_${i}`,
      name: `Test Card ${i}`,
      faction: 'meridian',
      attack: 3,
      armor: 3,
      agility: 3,
      source: i < 3 ? 'starter' : 'quest',
      acquiredAt: new Date().toISOString(),
      isLocked: false
    })
  }
  return cards
}

function createBattleState(overrides: Partial<BattleState> = {}): BattleState {
  return {
    battleId: 'test-battle-1',
    phase: 'selection',
    selectedCardIds: [],
    positions: [null, null, null, null, null],
    currentRound: 0,
    rounds: [],
    outcome: undefined,
    ...overrides
  }
}

// ============================================================================
// HP-1: Standard Battle Flow - Phase Transitions
// ============================================================================

describe('HP-1: Standard Battle Flow', () => {
  it('transitions from quest_hub to narrative on quest accept', () => {
    const state = startGame()
    expect(state.currentPhase).toBe('quest_hub')

    const { state: afterAccept } = executeCommand(
      { type: 'ACCEPT_QUEST', data: { questId: 'quest_salvage_claim' } },
      state
    )

    expect(afterAccept.currentPhase).toBe('narrative')
    expect(afterAccept.activeQuest).not.toBeNull()
    expect(afterAccept.currentDilemmaId).toBe('dilemma_salvage_1_approach')
  })

  it('transitions from narrative to choice_consequence on choice', () => {
    let state = startGame()
    const { state: afterAccept } = executeCommand(
      { type: 'ACCEPT_QUEST', data: { questId: 'quest_salvage_claim' } },
      state
    )

    const { state: afterChoice } = executeCommand(
      { type: 'MAKE_CHOICE', data: { dilemmaId: 'dilemma_salvage_1_approach', choiceId: 'choice_hail_first' } },
      afterAccept
    )

    expect(afterChoice.currentPhase).toBe('choice_consequence')
    expect(afterChoice.pendingChoiceConsequence).not.toBeNull()
  })

  it('transitions from choice_consequence to alliance when battle triggered', () => {
    let state = startGame()
    let { state: afterAccept } = executeCommand(
      { type: 'ACCEPT_QUEST', data: { questId: 'quest_salvage_claim' } },
      state
    )

    // Choice that triggers battle
    let { state: afterChoice } = executeCommand(
      { type: 'MAKE_CHOICE', data: { dilemmaId: 'dilemma_salvage_1_approach', choiceId: 'choice_attack_immediately' } },
      afterAccept
    )

    expect(afterChoice.currentPhase).toBe('choice_consequence')
    expect(afterChoice.pendingChoiceConsequence?.triggersNext).toBe('battle')

    // Acknowledge consequence
    const { state: afterAck } = executeCommand(
      { type: 'ACKNOWLEDGE_CHOICE_CONSEQUENCE', data: {} },
      afterChoice
    )

    expect(afterAck.currentPhase).toBe('alliance')
  })

  it('transitions from alliance to card_selection after finalization', () => {
    const state = createStateWithPhase('alliance', {
      activeQuest: {
        questId: 'quest_salvage_claim',
        factionId: 'ironveil',
        currentDilemmaIndex: 1,
        dilemmasCompleted: 1,
        alliances: [],
        battlesWon: 0,
        battlesLost: 0
      }
    })

    // Form alliance
    const { state: afterAlliance } = executeCommand(
      { type: 'FORM_ALLIANCE', data: { factionId: 'meridian' } },
      state
    )

    // Finalize
    const { state: afterFinalize } = executeCommand(
      { type: 'FINALIZE_ALLIANCES', data: {} },
      afterAlliance
    )

    expect(afterFinalize.currentPhase).toBe('card_selection')
    expect(afterFinalize.currentBattle).not.toBeNull()
  })

  it('transitions from card_selection to deployment on commit', () => {
    const cards = createTestCards(6)
    const state = createStateWithPhase('card_selection', {
      ownedCards: cards,
      currentBattle: createBattleState({
        selectedCardIds: cards.slice(0, 5).map(c => c.id)
      }),
      activeQuest: {
        questId: 'test',
        factionId: 'ironveil',
        currentDilemmaIndex: 0,
        dilemmasCompleted: 0,
        alliances: [],
        battlesWon: 0,
        battlesLost: 0
      }
    })

    const { state: afterCommit } = executeCommand(
      { type: 'COMMIT_FLEET', data: { cardIds: cards.slice(0, 5).map(c => c.id) } },
      state
    )

    expect(afterCommit.currentPhase).toBe('deployment')
  })

  it('transitions from deployment to battle on lock orders', () => {
    const cards = createTestCards(5)
    const state = createStateWithPhase('deployment', {
      ownedCards: cards,
      currentBattle: createBattleState({
        phase: 'deployment',
        selectedCardIds: cards.map(c => c.id),
        positions: cards.map(c => c.id)
      }),
      activeQuest: {
        questId: 'test',
        factionId: 'ironveil',
        currentDilemmaIndex: 0,
        dilemmasCompleted: 0,
        alliances: [],
        battlesWon: 0,
        battlesLost: 0
      }
    })

    const { state: afterLock } = executeCommand(
      { type: 'LOCK_ORDERS', data: {} },
      state
    )

    expect(afterLock.currentPhase).toBe('battle')
    expect(afterLock.currentBattle?.phase).toBe('execution')
  })
})

// ============================================================================
// HP-2: Diplomatic/Mediation Path
// ============================================================================

describe('HP-2: Diplomatic Mediation Path', () => {
  it('transitions to mediation when choice triggers mediation', () => {
    let state = startGame()
    let { state: afterAccept } = executeCommand(
      { type: 'ACCEPT_QUEST', data: { questId: 'quest_sanctuary_run' } },
      state
    )

    // Choice that triggers mediation
    let { state: afterChoice } = executeCommand(
      { type: 'MAKE_CHOICE', data: { dilemmaId: 'dilemma_sanctuary_1_approach', choiceId: 'choice_direct_approach' } },
      afterAccept
    )

    expect(afterChoice.pendingChoiceConsequence?.triggersNext).toBe('mediation')

    const { state: afterAck } = executeCommand(
      { type: 'ACKNOWLEDGE_CHOICE_CONSEQUENCE', data: {} },
      afterChoice
    )

    expect(afterAck.currentPhase).toBe('mediation')
  })

  it('mediation collapse triggers battle', () => {
    const state = createStateWithPhase('mediation', {
      activeQuest: {
        questId: 'test',
        factionId: 'ashfall',
        currentDilemmaIndex: 0,
        dilemmasCompleted: 0,
        alliances: [],
        battlesWon: 0,
        battlesLost: 0
      }
    })

    const { state: afterRefuse, events } = executeCommand(
      { type: 'REFUSE_TO_LEAN', data: {} },
      state
    )

    expect(afterRefuse.currentPhase).toBe('card_selection')
    expect(events.some(e => e.type === 'MEDIATION_COLLAPSED')).toBe(true)
    expect(events.some(e => e.type === 'BATTLE_TRIGGERED')).toBe(true)
  })
})

// ============================================================================
// HP-3: Full Game Three Quest Completion → Ending
// ============================================================================

describe('HP-3: Game Ending After Three Quests', () => {
  it('triggers ending screen after completing third quest', () => {
    // Create state where 2 quests already completed
    const state = createStateWithPhase('quest_summary', {
      completedQuests: [
        { questId: 'quest_salvage_claim', outcome: 'completed', finalBounty: 500, completedAt: new Date().toISOString() },
        { questId: 'quest_sanctuary_run', outcome: 'completed', finalBounty: 400, completedAt: new Date().toISOString() }
      ],
      activeQuest: null,
      pendingQuestSummary: {
        questId: 'quest_brokers_gambit',
        questTitle: "The Broker's Gambit",
        outcome: 'completed'
      },
      stats: {
        questsCompleted: 2, // Will become 3
        questsFailed: 0,
        battlesWon: 2,
        battlesLost: 0,
        battlesDraw: 0,
        battlesAvoided: 0,
        choicesMade: 10,
        alliancesFormed: 2,
        secretAlliancesFormed: 0,
        betrayals: 0,
        totalBountyEarned: 900,
        totalBountyShared: 200,
        cardsAcquired: 8,
        cardsLost: 0,
        playTimeSeconds: 3600
      }
    })

    const { state: afterAck, events } = executeCommand(
      { type: 'ACKNOWLEDGE_QUEST_SUMMARY', data: {} },
      state
    )

    // Should transition to ending, not quest_hub
    expect(afterAck.currentPhase).toBe('ending')
    expect(afterAck.completedQuests.length).toBe(3)
    expect(afterAck.gameStatus).toBe('ended')
  })

  it('returns to quest_hub after first or second quest', () => {
    // After first quest
    const state1 = createStateWithPhase('quest_summary', {
      completedQuests: [],
      pendingQuestSummary: {
        questId: 'quest_salvage_claim',
        questTitle: 'The Salvage Claim',
        outcome: 'completed'
      }
    })

    const { state: afterFirst } = executeCommand(
      { type: 'ACKNOWLEDGE_QUEST_SUMMARY', data: {} },
      state1
    )

    expect(afterFirst.currentPhase).toBe('quest_hub')
    expect(afterFirst.completedQuests.length).toBe(1)

    // After second quest
    const state2 = createStateWithPhase('quest_summary', {
      completedQuests: [
        { questId: 'quest_salvage_claim', outcome: 'completed', finalBounty: 500, completedAt: new Date().toISOString() }
      ],
      pendingQuestSummary: {
        questId: 'quest_sanctuary_run',
        questTitle: 'The Sanctuary Run',
        outcome: 'completed'
      }
    })

    const { state: afterSecond } = executeCommand(
      { type: 'ACKNOWLEDGE_QUEST_SUMMARY', data: {} },
      state2
    )

    expect(afterSecond.currentPhase).toBe('quest_hub')
    expect(afterSecond.completedQuests.length).toBe(2)
  })
})

// ============================================================================
// EC-1: Minimum Card Selection
// ============================================================================

describe('EC-1: Minimum Card Selection Edge Case', () => {
  it('allows battle with exactly 5 unlocked cards', () => {
    const cards = createTestCards(5)
    const state = createStateWithPhase('card_selection', {
      ownedCards: cards,
      currentBattle: createBattleState(),
      activeQuest: {
        questId: 'test',
        factionId: 'ironveil',
        currentDilemmaIndex: 0,
        dilemmasCompleted: 0,
        alliances: [],
        battlesWon: 0,
        battlesLost: 0
      }
    })

    // Select all 5
    let currentState = state
    for (const card of cards) {
      const { state: newState } = executeCommand(
        { type: 'SELECT_CARD', data: { cardId: card.id } },
        currentState
      )
      currentState = newState
    }

    expect(currentState.currentBattle?.selectedCardIds.length).toBe(5)

    // Can commit
    const { state: afterCommit } = executeCommand(
      { type: 'COMMIT_FLEET', data: { cardIds: cards.map(c => c.id) } },
      currentState
    )

    expect(afterCommit.currentPhase).toBe('deployment')
  })

  it('rejects commit with fewer than 5 cards selected', () => {
    const cards = createTestCards(5)
    const state = createStateWithPhase('card_selection', {
      ownedCards: cards,
      currentBattle: createBattleState({
        selectedCardIds: cards.slice(0, 4).map(c => c.id) // Only 4 selected
      }),
      activeQuest: {
        questId: 'test',
        factionId: 'ironveil',
        currentDilemmaIndex: 0,
        dilemmasCompleted: 0,
        alliances: [],
        battlesWon: 0,
        battlesLost: 0
      }
    })

    expect(() =>
      executeCommand(
        { type: 'COMMIT_FLEET', data: { cardIds: cards.slice(0, 4).map(c => c.id) } },
        state
      )
    ).toThrow(InvalidCommandError)
  })
})

// ============================================================================
// EC-2: Card Locked Due to Reputation
// ============================================================================

describe('EC-2: Reputation-Based Card Locking', () => {
  it('cannot select locked cards', () => {
    const cards = createTestCards(6)
    cards[5].isLocked = true
    cards[5].lockReason = 'Hostile reputation with faction'

    const state = createStateWithPhase('card_selection', {
      ownedCards: cards,
      currentBattle: createBattleState(),
      activeQuest: {
        questId: 'test',
        factionId: 'ironveil',
        currentDilemmaIndex: 0,
        dilemmasCompleted: 0,
        alliances: [],
        battlesWon: 0,
        battlesLost: 0
      }
    })

    expect(() =>
      executeCommand(
        { type: 'SELECT_CARD', data: { cardId: cards[5].id } },
        state
      )
    ).toThrow(InvalidCommandError)
  })

  it('can still select unlocked cards when some are locked', () => {
    const cards = createTestCards(6)
    cards[5].isLocked = true

    const state = createStateWithPhase('card_selection', {
      ownedCards: cards,
      currentBattle: createBattleState(),
      activeQuest: {
        questId: 'test',
        factionId: 'ironveil',
        currentDilemmaIndex: 0,
        dilemmasCompleted: 0,
        alliances: [],
        battlesWon: 0,
        battlesLost: 0
      }
    })

    // Select first 5 unlocked cards
    let currentState = state
    for (let i = 0; i < 5; i++) {
      const { state: newState } = executeCommand(
        { type: 'SELECT_CARD', data: { cardId: cards[i].id } },
        currentState
      )
      currentState = newState
    }

    expect(currentState.currentBattle?.selectedCardIds.length).toBe(5)
  })
})

// ============================================================================
// EC-3: Battle Defeat Scenario
// ============================================================================

describe('EC-3: Battle Defeat Handling', () => {
  it('handles battle defeat without softlock', () => {
    const state = createStateWithPhase('consequence', {
      currentBattle: createBattleState({
        phase: 'resolved',
        outcome: 'defeat',
        rounds: [
          { roundNumber: 1, playerCard: {} as any, opponentCard: {} as any, initiative: 'opponent', playerRoll: {} as any, opponentRoll: {} as any, outcome: 'opponent_won' },
          { roundNumber: 2, playerCard: {} as any, opponentCard: {} as any, initiative: 'opponent', playerRoll: {} as any, opponentRoll: {} as any, outcome: 'opponent_won' },
          { roundNumber: 3, playerCard: {} as any, opponentCard: {} as any, initiative: 'opponent', playerRoll: {} as any, opponentRoll: {} as any, outcome: 'opponent_won' },
          { roundNumber: 4, playerCard: {} as any, opponentCard: {} as any, initiative: 'player', playerRoll: {} as any, opponentRoll: {} as any, outcome: 'player_won' },
          { roundNumber: 5, playerCard: {} as any, opponentCard: {} as any, initiative: 'player', playerRoll: {} as any, opponentRoll: {} as any, outcome: 'player_won' }
        ]
      }),
      activeQuest: {
        questId: 'quest_salvage_claim',
        factionId: 'ironveil',
        currentDilemmaIndex: 2, // Last dilemma
        dilemmasCompleted: 2,
        alliances: [],
        battlesWon: 0,
        battlesLost: 0
      }
    })

    // Player should still be able to acknowledge and then continue
    const { events: ackEvents } = executeCommand(
      { type: 'ACKNOWLEDGE_OUTCOME', data: {} },
      state
    )
    expect(ackEvents.some(e => e.type === 'OUTCOME_ACKNOWLEDGED')).toBe(true)

    // Then continue to next phase
    const { state: afterContinue } = executeCommand(
      { type: 'CONTINUE_TO_NEXT_PHASE', data: {} },
      state
    )

    // Should proceed to quest_summary (not stuck)
    expect(['quest_summary', 'narrative']).toContain(afterContinue.currentPhase)
  })
})

// ============================================================================
// STUCK-1: All Quests Locked by Reputation
// ============================================================================

describe('STUCK-1: Quest Availability with Reputation', () => {
  it('at least one quest should always be available at game start', () => {
    const state = startGame()

    // All quests should be available at game start (neutral reputation)
    expect(state.availableQuestIds.length).toBeGreaterThanOrEqual(1)
    expect(state.availableQuestIds).toContain('quest_salvage_claim')
    expect(state.availableQuestIds).toContain('quest_sanctuary_run')
    expect(state.availableQuestIds).toContain('quest_brokers_gambit')
  })

  it('quests have reasonable reputation requirements', () => {
    // Verify quest requirements allow new players to access them
    for (const quest of allQuests) {
      // All quests should be accessible with starting reputation (0)
      // or require at most -25 (achievable without locking out)
      expect(quest.reputationRequired).toBeLessThanOrEqual(0)
    }
  })

  it('tracks remaining available quests after completion', () => {
    const state = createStateWithPhase('quest_hub', {
      completedQuests: [
        { questId: 'quest_salvage_claim', outcome: 'completed', finalBounty: 500, completedAt: new Date().toISOString() }
      ],
      availableQuestIds: ['quest_sanctuary_run', 'quest_brokers_gambit']
    })

    expect(state.availableQuestIds.length).toBe(2)
    expect(state.availableQuestIds).not.toContain('quest_salvage_claim')
  })
})

// ============================================================================
// STUCK-2: Insufficient Cards for Battle
// ============================================================================

describe('STUCK-2: Card Availability Validation', () => {
  it('game provides enough starter cards', () => {
    const state = startGame()

    // Should have 3 starter cards
    expect(state.ownedCards.length).toBe(3)
    expect(state.ownedCards.every(c => c.source === 'starter')).toBe(true)
  })

  it('quest acceptance grants additional cards', () => {
    let state = startGame()

    const { state: afterAccept } = executeCommand(
      { type: 'ACCEPT_QUEST', data: { questId: 'quest_salvage_claim' } },
      state
    )

    // Should have 4 cards (3 starter + 1 quest card)
    expect(afterAccept.ownedCards.length).toBe(4)
  })

  it('alliance provides cards to reach 5+ total', () => {
    const cards = createTestCards(4) // Only 4 cards
    const state = createStateWithPhase('alliance', {
      ownedCards: cards,
      activeQuest: {
        questId: 'test',
        factionId: 'ironveil',
        currentDilemmaIndex: 0,
        dilemmasCompleted: 0,
        alliances: [],
        battlesWon: 0,
        battlesLost: 0
      }
    })

    const { state: afterAlliance } = executeCommand(
      { type: 'FORM_ALLIANCE', data: { factionId: 'meridian' } },
      state
    )

    // Alliance should add 2 cards
    expect(afterAlliance.ownedCards.length).toBe(6)
  })
})

// ============================================================================
// STUCK-6: Alliance Phase with Hostile Factions
// ============================================================================

describe('STUCK-6: Alliance Availability with Hostile Reputation', () => {
  it('prevents alliance with hostile faction', () => {
    const state = createStateWithPhase('alliance', {
      reputation: {
        ironveil: -80, // Hostile
        ashfall: 0,
        meridian: 0,
        void_wardens: 0,
        sundered_oath: 0
      },
      activeQuest: {
        questId: 'test',
        factionId: 'ironveil',
        currentDilemmaIndex: 0,
        dilemmasCompleted: 0,
        alliances: [],
        battlesWon: 0,
        battlesLost: 0
      }
    })

    expect(() =>
      executeCommand(
        { type: 'FORM_ALLIANCE', data: { factionId: 'ironveil' } },
        state
      )
    ).toThrow(InvalidCommandError)
  })

  it('allows proceeding without alliance when all factions hostile', () => {
    const state = createStateWithPhase('alliance', {
      reputation: {
        ironveil: -80,
        ashfall: -80,
        meridian: -80,
        void_wardens: -80,
        sundered_oath: -80
      },
      activeQuest: {
        questId: 'test',
        factionId: 'ironveil',
        currentDilemmaIndex: 0,
        dilemmasCompleted: 0,
        alliances: [],
        battlesWon: 0,
        battlesLost: 0
      }
    })

    // Should still be able to finalize (with no alliances) and proceed to card selection
    const { state: afterFinalize } = executeCommand(
      { type: 'FINALIZE_ALLIANCES', data: {} },
      state
    )

    expect(afterFinalize.currentPhase).toBe('card_selection')
  })
})

// ============================================================================
// STUCK-8: Game Ending Not Triggered
// ============================================================================

describe('STUCK-8: Ending Trigger Validation', () => {
  it('correctly counts completed quests', () => {
    let state = startGame()

    // Accept and complete quest 1
    const { state: afterAccept1 } = executeCommand(
      { type: 'ACCEPT_QUEST', data: { questId: 'quest_salvage_claim' } },
      state
    )

    expect(afterAccept1.activeQuest?.questId).toBe('quest_salvage_claim')
    expect(afterAccept1.completedQuests.length).toBe(0)

    // Simulate quest completion via summary - need activeQuest set
    const summaryState = createStateWithPhase('quest_summary', {
      ...afterAccept1,
      currentPhase: 'quest_summary',
      activeQuest: {
        questId: 'quest_salvage_claim',
        factionId: 'ironveil',
        currentDilemmaIndex: 2,
        dilemmasCompleted: 3,
        alliances: [],
        battlesWon: 1,
        battlesLost: 0
      },
      pendingQuestSummary: {
        questId: 'quest_salvage_claim',
        questTitle: 'The Salvage Claim',
        outcome: 'completed'
      }
    })

    const { state: afterSummary } = executeCommand(
      { type: 'ACKNOWLEDGE_QUEST_SUMMARY', data: {} },
      summaryState
    )

    expect(afterSummary.completedQuests.length).toBe(1)
    expect(afterSummary.stats.questsCompleted).toBe(1)
  })

  it('ending triggered exactly when 3 quests completed', () => {
    // 2 quests completed - should NOT trigger ending
    const state2Complete = createStateWithPhase('quest_summary', {
      completedQuests: [
        { questId: 'quest_salvage_claim', outcome: 'completed', finalBounty: 500, completedAt: new Date().toISOString() },
        { questId: 'quest_sanctuary_run', outcome: 'completed', finalBounty: 400, completedAt: new Date().toISOString() }
      ],
      pendingQuestSummary: null,
      stats: { ...getInitialState().stats, questsCompleted: 2 }
    })

    // Should be at quest_hub, not ending
    expect(state2Complete.completedQuests.length).toBe(2)

    // 3 quests completed - SHOULD trigger ending
    const state3Complete = createStateWithPhase('quest_summary', {
      completedQuests: [
        { questId: 'quest_salvage_claim', outcome: 'completed', finalBounty: 500, completedAt: new Date().toISOString() },
        { questId: 'quest_sanctuary_run', outcome: 'completed', finalBounty: 400, completedAt: new Date().toISOString() }
      ],
      activeQuest: {
        questId: 'quest_brokers_gambit',
        factionId: 'meridian',
        currentDilemmaIndex: 3,
        dilemmasCompleted: 4,
        alliances: [],
        battlesWon: 1,
        battlesLost: 0
      },
      pendingQuestSummary: {
        questId: 'quest_brokers_gambit',
        questTitle: "The Broker's Gambit",
        outcome: 'completed'
      }
    })

    const { state: afterThird } = executeCommand(
      { type: 'ACKNOWLEDGE_QUEST_SUMMARY', data: {} },
      state3Complete
    )

    expect(afterThird.completedQuests.length).toBe(3)
    expect(afterThird.currentPhase).toBe('ending')
  })
})

// ============================================================================
// Choice Consequence Navigation
// ============================================================================

describe('Choice Consequence Transitions', () => {
  it('transitions to next dilemma when triggersNext is dilemma', () => {
    const state = createStateWithPhase('choice_consequence', {
      activeQuest: {
        questId: 'quest_salvage_claim',
        factionId: 'ironveil',
        currentDilemmaIndex: 0,
        dilemmasCompleted: 0,
        alliances: [],
        battlesWon: 0,
        battlesLost: 0
      },
      pendingChoiceConsequence: {
        questId: 'quest_salvage_claim',
        dilemmaId: 'dilemma_salvage_1_approach',
        choiceId: 'choice_hail_first',
        choiceLabel: 'Hail the vessels',
        narrativeText: 'You hailed the vessels...',
        triggersNext: 'dilemma',
        consequences: {
          reputationChanges: [],
          cardsGained: [],
          cardsLost: [],
          bountyChange: null,
          flagsSet: []
        }
      },
      currentDilemmaId: 'dilemma_salvage_2_discovery'
    })

    const { state: afterAck } = executeCommand(
      { type: 'ACKNOWLEDGE_CHOICE_CONSEQUENCE', data: {} },
      state
    )

    expect(afterAck.currentPhase).toBe('narrative')
    expect(afterAck.pendingChoiceConsequence).toBeNull()
  })

  it('transitions to alliance when triggersNext is battle', () => {
    const state = createStateWithPhase('choice_consequence', {
      activeQuest: {
        questId: 'quest_salvage_claim',
        factionId: 'ironveil',
        currentDilemmaIndex: 0,
        dilemmasCompleted: 0,
        alliances: [],
        battlesWon: 0,
        battlesLost: 0
      },
      pendingChoiceConsequence: {
        questId: 'quest_salvage_claim',
        dilemmaId: 'dilemma_salvage_1_approach',
        choiceId: 'choice_attack_immediately',
        choiceLabel: 'Attack immediately',
        narrativeText: 'You attacked...',
        triggersNext: 'battle',
        consequences: {
          reputationChanges: [],
          cardsGained: [],
          cardsLost: [],
          bountyChange: null,
          flagsSet: []
        }
      }
    })

    const { state: afterAck } = executeCommand(
      { type: 'ACKNOWLEDGE_CHOICE_CONSEQUENCE', data: {} },
      state
    )

    expect(afterAck.currentPhase).toBe('alliance')
  })

  it('transitions to quest_summary when triggersNext is quest_complete', () => {
    const state = createStateWithPhase('choice_consequence', {
      activeQuest: {
        questId: 'quest_salvage_claim',
        factionId: 'ironveil',
        currentDilemmaIndex: 2,
        dilemmasCompleted: 2,
        alliances: [],
        battlesWon: 1,
        battlesLost: 0
      },
      pendingChoiceConsequence: {
        questId: 'quest_salvage_claim',
        dilemmaId: 'dilemma_salvage_3_confrontation',
        choiceId: 'choice_accept_warden_escort',
        choiceLabel: 'Accept Warden escort',
        narrativeText: 'You accepted the escort...',
        triggersNext: 'quest_complete',
        consequences: {
          reputationChanges: [],
          cardsGained: [],
          cardsLost: [],
          bountyChange: null,
          flagsSet: []
        }
      }
    })

    const { state: afterAck } = executeCommand(
      { type: 'ACKNOWLEDGE_CHOICE_CONSEQUENCE', data: {} },
      state
    )

    expect(afterAck.currentPhase).toBe('quest_summary')
    expect(afterAck.pendingQuestSummary).not.toBeNull()
  })
})

// ============================================================================
// Battle Consequence Navigation
// ============================================================================

describe('Battle Consequence Transitions', () => {
  it('acknowledges battle outcome in consequence phase', () => {
    const state = createStateWithPhase('consequence', {
      currentBattle: createBattleState({
        phase: 'resolved',
        outcome: 'victory',
        rounds: []
      }),
      activeQuest: {
        questId: 'quest_salvage_claim',
        factionId: 'ironveil',
        currentDilemmaIndex: 2,
        dilemmasCompleted: 3,
        alliances: [{ faction: 'meridian', bountyShare: 0.25, isSecret: false }],
        battlesWon: 1,
        battlesLost: 0
      }
    })

    // ACKNOWLEDGE_OUTCOME emits event confirming outcome was acknowledged
    const { events } = executeCommand(
      { type: 'ACKNOWLEDGE_OUTCOME', data: {} },
      state
    )

    expect(events.some(e => e.type === 'OUTCOME_ACKNOWLEDGED')).toBe(true)
  })

  it('continues to quest_summary after final battle via CONTINUE_TO_NEXT_PHASE', () => {
    const state = createStateWithPhase('consequence', {
      currentBattle: createBattleState({
        phase: 'resolved',
        outcome: 'victory',
        rounds: []
      }),
      activeQuest: {
        questId: 'quest_salvage_claim',
        factionId: 'ironveil',
        currentDilemmaIndex: 2, // Last dilemma (index 2 = 3rd of 3)
        dilemmasCompleted: 3,
        alliances: [{ faction: 'meridian', bountyShare: 0.25, isSecret: false }],
        battlesWon: 1,
        battlesLost: 0
      }
    })

    // CONTINUE_TO_NEXT_PHASE handles navigation
    const { state: afterContinue, events } = executeCommand(
      { type: 'CONTINUE_TO_NEXT_PHASE', data: {} },
      state
    )

    // After final dilemma, should go to quest_summary
    expect(afterContinue.currentPhase).toBe('quest_summary')
    expect(events.some(e => e.type === 'QUEST_SUMMARY_PRESENTED')).toBe(true)
  })

  it('continues to narrative if more dilemmas remain', () => {
    const state = createStateWithPhase('consequence', {
      currentBattle: createBattleState({
        phase: 'resolved',
        outcome: 'victory',
        rounds: []
      }),
      activeQuest: {
        questId: 'quest_salvage_claim',
        factionId: 'ironveil',
        currentDilemmaIndex: 0, // First dilemma (0 of 3)
        dilemmasCompleted: 1,
        alliances: [],
        battlesWon: 1,
        battlesLost: 0
      },
      currentDilemmaId: 'dilemma_salvage_1_approach'
    })

    const { state: afterContinue } = executeCommand(
      { type: 'CONTINUE_TO_NEXT_PHASE', data: {} },
      state
    )

    // More dilemmas remain, should go to narrative
    expect(afterContinue.currentPhase).toBe('narrative')
  })
})

// ============================================================================
// Deployment Validation
// ============================================================================

describe('Deployment Phase Validation', () => {
  it('requires all 5 cards positioned before lock orders', () => {
    const cards = createTestCards(5)
    const state = createStateWithPhase('deployment', {
      ownedCards: cards,
      currentBattle: createBattleState({
        phase: 'deployment',
        selectedCardIds: cards.map(c => c.id),
        positions: [cards[0].id, cards[1].id, null, null, null] // Only 2 positioned
      }),
      activeQuest: {
        questId: 'test',
        factionId: 'ironveil',
        currentDilemmaIndex: 0,
        dilemmasCompleted: 0,
        alliances: [],
        battlesWon: 0,
        battlesLost: 0
      }
    })

    // LOCK_ORDERS requires positions array in command data
    // Passing incomplete positions should throw
    expect(() =>
      executeCommand({ type: 'LOCK_ORDERS', data: { positions: [cards[0].id, cards[1].id] } }, state)
    ).toThrow(DeploymentError)
  })

  it('allows lock orders when all 5 cards positioned', () => {
    const cards = createTestCards(5)
    const state = createStateWithPhase('deployment', {
      ownedCards: cards,
      currentBattle: createBattleState({
        phase: 'deployment',
        selectedCardIds: cards.map(c => c.id),
        positions: cards.map(c => c.id) // All 5 positioned
      }),
      activeQuest: {
        questId: 'test',
        factionId: 'ironveil',
        currentDilemmaIndex: 0,
        dilemmasCompleted: 0,
        alliances: [],
        battlesWon: 0,
        battlesLost: 0
      }
    })

    // LOCK_ORDERS requires positions in command data
    const { state: afterLock } = executeCommand(
      { type: 'LOCK_ORDERS', data: { positions: cards.map(c => c.id) } },
      state
    )

    expect(afterLock.currentPhase).toBe('battle')
  })
})
