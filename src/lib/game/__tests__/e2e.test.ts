// ============================================================================
// E2E TESTS - Full Game Flow Tests
// ============================================================================
//
// These tests verify complete game flows from start to finish,
// simulating actual player journeys through the game.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { decide } from '../decider'
import { evolveState, getInitialState } from '../projections'
import type { GameState } from '../types'
import type { GameEvent } from '../events'
import type { GameCommand } from '../commands'

// ----------------------------------------------------------------------------
// Test Helpers
// ----------------------------------------------------------------------------

function executeCommand(command: GameCommand, state: GameState): {
  state: GameState
  events: GameEvent[]
} {
  const events = decide(command, state)
  const newState = events.reduce(evolveState, state)
  return { state: newState, events }
}

function executeCommands(commands: GameCommand[], initialState: GameState): {
  state: GameState
  allEvents: GameEvent[]
} {
  let state = initialState
  const allEvents: GameEvent[] = []

  for (const command of commands) {
    const { state: newState, events } = executeCommand(command, state)
    state = newState
    allEvents.push(...events)
  }

  return { state, allEvents }
}

// ----------------------------------------------------------------------------
// E2E Tests
// ----------------------------------------------------------------------------

describe('E2E: Complete Game Flows', () => {
  describe('Quest Completion Flow', () => {
    it('should complete a full quest from start to alliance phase', () => {
      const commands: GameCommand[] = [
        // 1. Start the game
        { type: 'START_GAME', data: { playerId: 'e2e-player' } },

        // 2. Accept a quest
        { type: 'ACCEPT_QUEST', data: { questId: 'quest_salvage_claim' } },

        // 3. Make first narrative choice (triggers alliance)
        { type: 'MAKE_CHOICE', data: {
          dilemmaId: 'dilemma_salvage_1_approach',
          choiceId: 'choice_attack_immediately'
        }},

        // 4. Form alliance with friendly faction
        { type: 'FORM_ALLIANCE', data: { factionId: 'meridian' } },

        // 5. Finalize alliances and trigger battle
        { type: 'FINALIZE_ALLIANCES', data: {} }
      ]

      const { state, allEvents } = executeCommands(commands, getInitialState())

      // Verify final state
      expect(state.gameStatus).toBe('in_progress')
      expect(state.currentPhase).toBe('card_selection')
      expect(state.activeQuest?.questId).toBe('quest_salvage_claim')
      expect(state.ownedCards.length).toBeGreaterThanOrEqual(5)

      // Verify key events occurred
      const eventTypes = allEvents.map(e => e.type)
      expect(eventTypes).toContain('GAME_STARTED')
      expect(eventTypes).toContain('QUEST_ACCEPTED')
      expect(eventTypes).toContain('CHOICE_MADE')
      expect(eventTypes).toContain('ALLIANCE_FORMED')
      expect(eventTypes).toContain('BATTLE_TRIGGERED')
    })

    it('should handle diplomatic path through narrative', () => {
      const commands: GameCommand[] = [
        { type: 'START_GAME', data: { playerId: 'e2e-player' } },
        { type: 'ACCEPT_QUEST', data: { questId: 'quest_salvage_claim' } },

        // Diplomatic choice - hail first
        { type: 'MAKE_CHOICE', data: {
          dilemmaId: 'dilemma_salvage_1_approach',
          choiceId: 'choice_hail_first'
        }}
      ]

      const { state, allEvents } = executeCommands(commands, getInitialState())

      // Should still be in narrative (next dilemma)
      expect(state.currentPhase).toBe('narrative')

      // Meridian reputation should have increased
      expect(state.reputation.meridian).toBe(5)

      // Flag should be set
      const flagEvent = allEvents.find(e =>
        e.type === 'FLAG_SET' && e.data.flagName === 'salvage_hailed_first'
      )
      expect(flagEvent).toBeDefined()
    })
  })

  describe('Battle Preparation Flow', () => {
    it('should prepare for battle with card selection and deployment', () => {
      // Get to card selection phase
      const setupCommands: GameCommand[] = [
        { type: 'START_GAME', data: { playerId: 'e2e-player' } },
        { type: 'ACCEPT_QUEST', data: { questId: 'quest_salvage_claim' } },
        { type: 'MAKE_CHOICE', data: {
          dilemmaId: 'dilemma_salvage_1_approach',
          choiceId: 'choice_attack_immediately'
        }},
        { type: 'FORM_ALLIANCE', data: { factionId: 'meridian' } },
        { type: 'FINALIZE_ALLIANCES', data: {} }
      ]

      let { state } = executeCommands(setupCommands, getInitialState())

      expect(state.currentPhase).toBe('card_selection')
      expect(state.currentBattle).not.toBeNull()

      // Select 5 cards individually (this updates selectedCardIds)
      const cardIds = state.ownedCards.slice(0, 5).map(c => c.id)
      for (const cardId of cardIds) {
        ;({ state } = executeCommand(
          { type: 'SELECT_CARD', data: { cardId } },
          state
        ))
      }

      expect(state.currentBattle?.selectedCardIds).toHaveLength(5)

      // Commit fleet
      ;({ state } = executeCommand(
        { type: 'COMMIT_FLEET', data: { cardIds } },
        state
      ))

      expect(state.currentPhase).toBe('deployment')
    })
  })

  describe('Reputation Journey', () => {
    it('should track reputation changes across multiple interactions', () => {
      let state = getInitialState()

      // Start game - all factions start neutral
      ;({ state } = executeCommand(
        { type: 'START_GAME', data: { playerId: 'e2e-player' } },
        state
      ))

      expect(state.reputation.ironveil).toBe(0)
      expect(state.reputation.meridian).toBe(0)
      expect(state.reputation.ashfall).toBe(0)

      // Accept Ironveil quest
      ;({ state } = executeCommand(
        { type: 'ACCEPT_QUEST', data: { questId: 'quest_salvage_claim' } },
        state
      ))

      // Make choice that favors Meridian (hail first: +5 meridian)
      ;({ state } = executeCommand(
        { type: 'MAKE_CHOICE', data: {
          dilemmaId: 'dilemma_salvage_1_approach',
          choiceId: 'choice_hail_first'
        }},
        state
      ))

      expect(state.reputation.meridian).toBe(5)
    })
  })

  describe('Card Economy Flow', () => {
    it('should properly track card acquisition through game flow', () => {
      let state = getInitialState()

      // Start game - should have 3 starter cards
      ;({ state } = executeCommand(
        { type: 'START_GAME', data: { playerId: 'e2e-player' } },
        state
      ))
      expect(state.ownedCards.length).toBe(3)

      const starterCards = state.ownedCards.map(c => c.id)
      expect(starterCards).toContain('starter_scout')
      expect(starterCards).toContain('starter_freighter')
      expect(starterCards).toContain('starter_corvette')

      // Accept quest - should gain 1 quest card
      ;({ state } = executeCommand(
        { type: 'ACCEPT_QUEST', data: { questId: 'quest_salvage_claim' } },
        state
      ))
      expect(state.ownedCards.length).toBe(4)
      expect(state.ownedCards.some(c => c.id === 'ironveil_ironclad')).toBe(true)

      // Go to alliance phase
      ;({ state } = executeCommand(
        { type: 'MAKE_CHOICE', data: {
          dilemmaId: 'dilemma_salvage_1_approach',
          choiceId: 'choice_attack_immediately'
        }},
        state
      ))

      // Form alliance - should gain 2 alliance cards
      ;({ state } = executeCommand(
        { type: 'FORM_ALLIANCE', data: { factionId: 'meridian' } },
        state
      ))
      expect(state.ownedCards.length).toBe(6)

      // Check alliance cards are from Meridian
      const meridianCards = state.ownedCards.filter(c => c.faction === 'meridian')
      expect(meridianCards.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Bounty Flow', () => {
    it('should track bounty changes through quest', () => {
      let state = getInitialState()

      // Start game - base bounty is 0
      ;({ state } = executeCommand(
        { type: 'START_GAME', data: { playerId: 'e2e-player' } },
        state
      ))
      expect(state.bounty).toBe(0)

      // Accept quest - should get initial bounty (500 for salvage claim)
      ;({ state } = executeCommand(
        { type: 'ACCEPT_QUEST', data: { questId: 'quest_salvage_claim' } },
        state
      ))
      expect(state.bounty).toBe(500)
    })
  })

  describe('Multiple Alliance Flow', () => {
    it('should allow forming multiple alliances', () => {
      let state = getInitialState()

      const setupCommands: GameCommand[] = [
        { type: 'START_GAME', data: { playerId: 'e2e-player' } },
        { type: 'ACCEPT_QUEST', data: { questId: 'quest_salvage_claim' } },
        { type: 'MAKE_CHOICE', data: {
          dilemmaId: 'dilemma_salvage_1_approach',
          choiceId: 'choice_attack_immediately'
        }}
      ]

      ;({ state } = executeCommands(setupCommands, getInitialState()))
      const cardsBefore = state.ownedCards.length

      // Form first alliance
      ;({ state } = executeCommand(
        { type: 'FORM_ALLIANCE', data: { factionId: 'meridian' } },
        state
      ))
      expect(state.ownedCards.length).toBe(cardsBefore + 2)

      // Form second alliance (if not hostile)
      ;({ state } = executeCommand(
        { type: 'FORM_ALLIANCE', data: { factionId: 'void_wardens' } },
        state
      ))
      expect(state.ownedCards.length).toBe(cardsBefore + 4)

      // Should have alliances tracked
      expect(state.activeQuest?.alliances.length).toBe(2)
    })
  })

  describe('Error Handling', () => {
    it('should reject invalid game actions', () => {
      const state = getInitialState()

      // Can't make choice before game starts
      expect(() =>
        executeCommand(
          { type: 'MAKE_CHOICE', data: { dilemmaId: 'test', choiceId: 'test' } },
          state
        )
      ).toThrow()

      // Start game
      const { state: startedState } = executeCommand(
        { type: 'START_GAME', data: { playerId: 'player-1' } },
        state
      )

      // Can't make choice without active quest
      expect(() =>
        executeCommand(
          { type: 'MAKE_CHOICE', data: { dilemmaId: 'test', choiceId: 'test' } },
          startedState
        )
      ).toThrow('Not in narrative phase')

      // Can't accept non-existent quest
      expect(() =>
        executeCommand(
          { type: 'ACCEPT_QUEST', data: { questId: 'fake_quest' } },
          startedState
        )
      ).toThrow('Quest not found')
    })
  })
})
