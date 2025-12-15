// ============================================================================
// INTEGRATION TESTS - Cross-Slice Interactions
// ============================================================================
//
// These tests verify that slices work together correctly through the
// command → event → projection flow.
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
// Integration Tests
// ----------------------------------------------------------------------------

describe('Cross-Slice Integration', () => {
  describe('Quest → Narrative → Alliance Flow', () => {
    it('should flow from quest acceptance through narrative to alliance phase', () => {
      // Start game
      let { state, events } = executeCommand(
        { type: 'START_GAME', data: { playerId: 'player-1' } },
        getInitialState()
      )

      expect(state.gameStatus).toBe('in_progress')
      expect(state.currentPhase).toBe('quest_hub')
      expect(state.ownedCards.length).toBe(3) // Starter cards

      // Accept quest
      ;({ state, events } = executeCommand(
        { type: 'ACCEPT_QUEST', data: { questId: 'quest_salvage_claim' } },
        state
      ))

      expect(state.currentPhase).toBe('narrative')
      expect(state.activeQuest?.questId).toBe('quest_salvage_claim')
      expect(state.ownedCards.length).toBe(4) // 3 starter + 1 quest card

      // Make choice that triggers alliance phase
      ;({ state, events } = executeCommand(
        { type: 'MAKE_CHOICE', data: { dilemmaId: 'dilemma_salvage_1_approach', choiceId: 'choice_attack_immediately' } },
        state
      ))

      expect(state.currentPhase).toBe('alliance')
    })

    it('should enforce minimum card requirement before battle', () => {
      // Setup: Game started, quest accepted, in alliance phase with 4 cards
      let state = getInitialState()
      const commands: GameCommand[] = [
        { type: 'START_GAME', data: { playerId: 'player-1' } },
        { type: 'ACCEPT_QUEST', data: { questId: 'quest_salvage_claim' } },
        { type: 'MAKE_CHOICE', data: { dilemmaId: 'dilemma_salvage_1_approach', choiceId: 'choice_attack_immediately' } }
      ]

      const { state: allianceState } = executeCommands(commands, state)

      expect(allianceState.currentPhase).toBe('alliance')
      expect(allianceState.ownedCards.length).toBe(4) // Not enough for battle

      // Trying to decline all alliances should fail (not enough cards)
      expect(() =>
        executeCommand({ type: 'DECLINE_ALL_ALLIANCES', data: {} }, allianceState)
      ).toThrow('Cannot proceed without allies')
    })

    it('should allow proceeding after forming alliance', () => {
      // Setup: In alliance phase with 4 cards
      let state = getInitialState()
      const setupCommands: GameCommand[] = [
        { type: 'START_GAME', data: { playerId: 'player-1' } },
        { type: 'ACCEPT_QUEST', data: { questId: 'quest_salvage_claim' } },
        { type: 'MAKE_CHOICE', data: { dilemmaId: 'dilemma_salvage_1_approach', choiceId: 'choice_attack_immediately' } }
      ]

      let { state: allianceState } = executeCommands(setupCommands, state)

      expect(allianceState.ownedCards.length).toBe(4)

      // Form alliance - should get 2 cards
      ;({ state: allianceState } = executeCommand(
        { type: 'FORM_ALLIANCE', data: { factionId: 'meridian' } },
        allianceState
      ))

      expect(allianceState.ownedCards.length).toBe(6) // 4 + 2 alliance cards

      // Now can finalize and proceed to battle
      const { state: battleState } = executeCommand(
        { type: 'FINALIZE_ALLIANCES', data: {} },
        allianceState
      )

      expect(battleState.currentPhase).toBe('card_selection')
      expect(battleState.currentBattle).not.toBeNull()
    })
  })

  describe('Card Selection → Deployment → Battle Flow', () => {
    it('should flow from card selection through deployment to battle', () => {
      // Setup: Get to card selection phase with enough cards
      let state = getInitialState()
      const setupCommands: GameCommand[] = [
        { type: 'START_GAME', data: { playerId: 'player-1' } },
        { type: 'ACCEPT_QUEST', data: { questId: 'quest_salvage_claim' } },
        { type: 'MAKE_CHOICE', data: { dilemmaId: 'dilemma_salvage_1_approach', choiceId: 'choice_attack_immediately' } },
        { type: 'FORM_ALLIANCE', data: { factionId: 'meridian' } },
        { type: 'FINALIZE_ALLIANCES', data: {} }
      ]

      let { state: cardSelectionState } = executeCommands(setupCommands, state)

      expect(cardSelectionState.currentPhase).toBe('card_selection')
      expect(cardSelectionState.ownedCards.length).toBeGreaterThanOrEqual(5)

      // Select 5 cards for battle
      const cardIds = cardSelectionState.ownedCards.slice(0, 5).map(c => c.id)

      // Commit fleet
      const { state: deploymentState, events } = executeCommand(
        { type: 'COMMIT_FLEET', data: { cardIds } },
        cardSelectionState
      )

      expect(deploymentState.currentPhase).toBe('deployment')
      expect(events.some(e => e.type === 'FLEET_COMMITTED')).toBe(true)
    })
  })

  describe('Mediation → Consequence Flow', () => {
    it('should flow from mediation lean to compromise to consequence', () => {
      // Setup a mediation scenario
      let state: GameState = {
        ...getInitialState(),
        gameStatus: 'in_progress',
        currentPhase: 'mediation',
        currentMediationId: 'mediation-1',
        activeQuest: {
          questId: 'quest-1',
          factionId: 'ironveil',
          currentDilemmaIndex: 0,
          dilemmasCompleted: 0,
          alliances: [],
          battlesWon: 0,
          battlesLost: 0
        },
        // Mediation state fields needed by slice
        hasLeaned: false,
        leanedToward: null,
        mediationParties: ['ironveil', 'ashfall']
      } as GameState & { hasLeaned: boolean; leanedToward: string | null; mediationParties: string[] }

      // Lean toward a faction
      let { state: leanedState, events } = executeCommand(
        { type: 'LEAN_TOWARD_FACTION', data: { towardFactionId: 'ironveil' } },
        state
      )

      expect(events.some(e => e.type === 'MEDIATION_LEANED')).toBe(true)

      // Update state with lean info for next command
      leanedState = { ...leanedState, hasLeaned: true, leanedToward: 'ironveil' } as typeof leanedState

      // Accept compromise
      const { state: consequenceState, events: compromiseEvents } = executeCommand(
        { type: 'ACCEPT_COMPROMISE', data: {} },
        leanedState
      )

      expect(compromiseEvents.some(e => e.type === 'COMPROMISE_ACCEPTED')).toBe(true)
      expect(consequenceState.currentPhase).toBe('consequence')
    })

    it('should flow from mediation refusal to battle', () => {
      let state: GameState = {
        ...getInitialState(),
        gameStatus: 'in_progress',
        currentPhase: 'mediation',
        currentMediationId: 'mediation-1',
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

      // Refuse to lean - triggers battle
      const { state: battleState, events } = executeCommand(
        { type: 'REFUSE_TO_LEAN', data: {} },
        state
      )

      expect(events.some(e => e.type === 'MEDIATION_COLLAPSED')).toBe(true)
      expect(battleState.currentPhase).toBe('card_selection')
    })
  })

  describe('Reputation Flow Across Choices', () => {
    it('should accumulate reputation changes through multiple choices', () => {
      let state = getInitialState()

      // Start game and accept quest
      ;({ state } = executeCommand(
        { type: 'START_GAME', data: { playerId: 'player-1' } },
        state
      ))

      const initialMeridianRep = state.reputation.meridian
      const initialIronveilRep = state.reputation.ironveil

      ;({ state } = executeCommand(
        { type: 'ACCEPT_QUEST', data: { questId: 'quest_salvage_claim' } },
        state
      ))

      // Make choice that affects reputation (choice_hail_first gives +5 meridian)
      ;({ state } = executeCommand(
        { type: 'MAKE_CHOICE', data: { dilemmaId: 'dilemma_salvage_1_approach', choiceId: 'choice_hail_first' } },
        state
      ))

      expect(state.reputation.meridian).toBe(initialMeridianRep + 5)
    })
  })

  describe('Card Flow Through Alliance and Battle', () => {
    it('should track card ownership through alliance formation', () => {
      let state = getInitialState()
      const setupCommands: GameCommand[] = [
        { type: 'START_GAME', data: { playerId: 'player-1' } },
        { type: 'ACCEPT_QUEST', data: { questId: 'quest_salvage_claim' } },
        { type: 'MAKE_CHOICE', data: { dilemmaId: 'dilemma_salvage_1_approach', choiceId: 'choice_attack_immediately' } }
      ]

      let { state: allianceState } = executeCommands(setupCommands, state)
      const cardCountBefore = allianceState.ownedCards.length

      // Form alliance with meridian
      ;({ state: allianceState } = executeCommand(
        { type: 'FORM_ALLIANCE', data: { factionId: 'meridian' } },
        allianceState
      ))

      // Should have gained 2 alliance cards
      expect(allianceState.ownedCards.length).toBe(cardCountBefore + 2)

      // Alliance cards should be from the allied faction
      const newCards = allianceState.ownedCards.slice(-2)
      newCards.forEach(card => {
        expect(card.faction).toBe('meridian')
      })
    })
  })
})
