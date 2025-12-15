// ============================================================================
// SPACE FORTRESS - Given-When-Then Test Helpers
// ============================================================================
//
// Test infrastructure for business rules following event modeling patterns:
// - GIVEN: Past events that build current state
// - WHEN: Command being processed
// - THEN: Resulting events or error
//
// ============================================================================

import { expect } from 'vitest'
import { decide, InvalidCommandError } from '../decider'
import { rebuildState, getInitialState } from '../projections'
import type { GameCommand } from '../commands'
import type { GameEvent } from '../events'
import type { GameState, FactionId, OwnedCard, GamePhase } from '../types'

// ----------------------------------------------------------------------------
// Core Test Helper
// ----------------------------------------------------------------------------

/**
 * Given-When-Then test helper for decider rules
 *
 * @example
 * testDecider({
 *   given: [gameStartedEvents],
 *   when: { type: 'ACCEPT_QUEST', data: { questId: 'quest_salvage_claim' } },
 *   then: expectEvents([{ type: 'QUEST_ACCEPTED' }, { type: 'PHASE_CHANGED' }])
 * })
 *
 * @example
 * testDecider({
 *   given: [gameStartedEvents],
 *   when: { type: 'ACCEPT_QUEST', data: { questId: 'invalid' } },
 *   then: expectError('Quest not found')
 * })
 */
export function testDecider(params: {
  given: GameEvent[]
  when: GameCommand
  then: TestExpectation
}): void {
  const state = rebuildState(params.given)

  if (params.then.type === 'error') {
    expect(() => decide(params.when, state)).toThrow(InvalidCommandError)
    if (params.then.message) {
      expect(() => decide(params.when, state)).toThrow(params.then.message)
    }
  } else if (params.then.type === 'events') {
    const events = decide(params.when, state)

    // Check minimum event count
    expect(events.length).toBeGreaterThanOrEqual(params.then.events.length)

    // Match expected events (allowing for timestamps and generated IDs)
    params.then.events.forEach((expectedEvent, i) => {
      const actual = events.find(e => e.type === expectedEvent.type)
      expect(actual).toBeDefined()

      if (expectedEvent.data) {
        expect(actual).toMatchObject({
          type: expectedEvent.type,
          data: expect.objectContaining(
            filterTimestamps(expectedEvent.data)
          )
        })
      }
    })
  } else if (params.then.type === 'contains') {
    const events = decide(params.when, state)
    const expectation = params.then as { type: 'contains'; eventType: string; withData?: Record<string, unknown> }
    const foundEvent = events.find(e => e.type === expectation.eventType)
    expect(foundEvent).toBeDefined()

    if (expectation.withData) {
      expect(foundEvent?.data).toMatchObject(expectation.withData)
    }
  }
}

type TestExpectation =
  | { type: 'error'; message?: string }
  | { type: 'events'; events: Array<{ type: string; data?: Record<string, unknown> }> }
  | { type: 'contains'; eventType: string; withData?: Record<string, unknown> }

// Expectation builders
export function expectError(message?: string): TestExpectation {
  return { type: 'error', message }
}

export function expectEvents(events: Array<{ type: string; data?: Record<string, unknown> }>): TestExpectation {
  return { type: 'events', events }
}

export function expectContains(eventType: string, withData?: Record<string, unknown>): TestExpectation {
  return { type: 'contains', eventType, withData }
}

// Helper to filter out timestamps from comparison
function filterTimestamps(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).filter(([k]) => k !== 'timestamp')
  )
}

// ----------------------------------------------------------------------------
// Timestamp Helper
// ----------------------------------------------------------------------------

let timestampCounter = 0

export function ts(offset = 0): string {
  timestampCounter++
  return new Date(Date.now() + offset + timestampCounter).toISOString()
}

export function resetTimestamps(): void {
  timestampCounter = 0
}

// ----------------------------------------------------------------------------
// Event Factories
// ----------------------------------------------------------------------------

export const events = {
  gameStarted: (playerId = 'test-player'): GameEvent => ({
    type: 'GAME_STARTED',
    data: {
      timestamp: ts(),
      playerId,
      starterCardIds: ['starter_scout', 'starter_freighter', 'starter_corvette']
    }
  }),

  phaseChanged: (fromPhase: GamePhase, toPhase: GamePhase): GameEvent => ({
    type: 'PHASE_CHANGED',
    data: { timestamp: ts(), fromPhase, toPhase }
  }),

  questsGenerated: (questIds: string[] = ['quest_salvage_claim', 'quest_sanctuary_run', 'quest_brokers_gambit']): GameEvent => ({
    type: 'QUESTS_GENERATED',
    data: { timestamp: ts(), questIds }
  }),

  cardGained: (cardId: string, factionId: FactionId = 'meridian', source: 'starter' | 'quest' | 'alliance' | 'choice' = 'starter'): GameEvent => ({
    type: 'CARD_GAINED',
    data: { timestamp: ts(), cardId, factionId, source }
  }),

  cardLost: (cardId: string, factionId: FactionId = 'meridian', reason: 'reputation' | 'betrayal' | 'choice' | 'penalty' = 'choice'): GameEvent => ({
    type: 'CARD_LOST',
    data: { timestamp: ts(), cardId, factionId, reason }
  }),

  questAccepted: (questId: string, factionId: FactionId = 'ironveil', initialBounty = 500): GameEvent => ({
    type: 'QUEST_ACCEPTED',
    data: {
      timestamp: ts(),
      questId,
      factionId,
      initialBounty,
      initialCardIds: []
    }
  }),

  reputationChanged: (factionId: FactionId, delta: number, newValue: number, source: 'quest' | 'choice' | 'alliance' | 'battle' | 'betrayal' | 'discovery' = 'choice'): GameEvent => ({
    type: 'REPUTATION_CHANGED',
    data: { timestamp: ts(), factionId, delta, newValue, source }
  }),

  alliancePhaseStarted: (questId: string, battleContext: string, availableFactionIds: FactionId[]): GameEvent => ({
    type: 'ALLIANCE_PHASE_STARTED',
    data: {
      timestamp: ts(),
      questId,
      battleContext,
      availableFactionIds
    }
  }),

  allianceFormed: (factionId: FactionId, bountyShare: number, cardIdsProvided: string[], isSecret = false): GameEvent => ({
    type: 'ALLIANCE_FORMED',
    data: {
      timestamp: ts(),
      factionId,
      bountyShare,
      cardIdsProvided,
      isSecret
    }
  }),

  battleTriggered: (battleId: string, questId: string, context: string): GameEvent => ({
    type: 'BATTLE_TRIGGERED',
    data: {
      timestamp: ts(),
      battleId,
      questId,
      context,
      opponentType: 'scavengers',
      opponentFactionId: 'scavengers' as FactionId | 'scavengers',
      difficulty: 'medium' as const
    }
  }),

  cardSelected: (cardId: string, battleId: string): GameEvent => ({
    type: 'CARD_SELECTED',
    data: { timestamp: ts(), cardId, battleId }
  }),

  fleetCommitted: (battleId: string, cardIds: string[]): GameEvent => ({
    type: 'FLEET_COMMITTED',
    data: { timestamp: ts(), battleId, cardIds }
  }),

  dilemmaPresented: (dilemmaId: string, questId: string): GameEvent => ({
    type: 'DILEMMA_PRESENTED',
    data: {
      timestamp: ts(),
      dilemmaId,
      questId
    }
  }),

  choiceMade: (dilemmaId: string, choiceId: string, questId: string): GameEvent => ({
    type: 'CHOICE_MADE',
    data: { timestamp: ts(), dilemmaId, choiceId, questId }
  })
}

// ----------------------------------------------------------------------------
// Command Factories
// ----------------------------------------------------------------------------

export const commands = {
  startGame: (playerId = 'test-player'): GameCommand => ({
    type: 'START_GAME',
    data: { playerId }
  }),

  acceptQuest: (questId: string): GameCommand => ({
    type: 'ACCEPT_QUEST',
    data: { questId }
  }),

  makeChoice: (dilemmaId: string, choiceId: string): GameCommand => ({
    type: 'MAKE_CHOICE',
    data: { dilemmaId, choiceId }
  }),

  formAlliance: (factionId: FactionId): GameCommand => ({
    type: 'FORM_ALLIANCE',
    data: { factionId }
  }),

  declineAllAlliances: (): GameCommand => ({
    type: 'DECLINE_ALL_ALLIANCES',
    data: {}
  }),

  selectCard: (cardId: string): GameCommand => ({
    type: 'SELECT_CARD',
    data: { cardId }
  }),

  deselectCard: (cardId: string): GameCommand => ({
    type: 'DESELECT_CARD',
    data: { cardId }
  }),

  commitFleet: (cardIds: string[]): GameCommand => ({
    type: 'COMMIT_FLEET',
    data: { cardIds }
  }),

  lockOrders: (positions: string[]): GameCommand => ({
    type: 'LOCK_ORDERS',
    data: { positions }
  })
}

// ----------------------------------------------------------------------------
// State Builder Helpers
// ----------------------------------------------------------------------------

/**
 * Create a standard game start event sequence (3 starter cards + quest hub phase)
 * Note: The game starts with only 3 cards, not 5. Players need quest + alliance cards.
 */
export function createGameStartEvents(playerId = 'test-player'): GameEvent[] {
  return [
    events.gameStarted(playerId),
    events.phaseChanged('not_started', 'quest_hub'),
    events.cardGained('starter_scout', 'meridian', 'starter'),
    events.cardGained('starter_freighter', 'meridian', 'starter'),
    events.cardGained('starter_corvette', 'meridian', 'starter'),
    events.questsGenerated()
  ]
}

/**
 * Create events that result in a specific number of owned cards
 */
export function createEventsWithCardCount(cardCount: number): GameEvent[] {
  const baseEvents = createGameStartEvents()

  // We start with 4 cards, add more if needed
  const additionalCards = Math.max(0, cardCount - 4)
  for (let i = 0; i < additionalCards; i++) {
    baseEvents.push(events.cardGained(`extra_card_${i}`, 'ironveil', 'quest'))
  }

  // Remove cards if we need fewer than 4
  const cardsToRemove = Math.max(0, 4 - cardCount)
  for (let i = 0; i < cardsToRemove; i++) {
    baseEvents.push(events.cardLost('starter_scout', 'meridian', 'choice'))
  }

  return baseEvents
}

/**
 * Create events leading up to alliance phase with a specific card count
 */
export function createAlliancePhaseEvents(ownedCardCount: number, questId = 'quest_salvage_claim'): GameEvent[] {
  const baseEvents = createEventsWithCardCount(ownedCardCount)

  // Add quest acceptance and progress to alliance phase
  baseEvents.push(
    events.questAccepted(questId, 'ironveil', 500),
    events.cardGained('quest_card_1', 'ironveil', 'quest'), // Quest grants 1 card
    events.phaseChanged('narrative', 'alliance'),
    events.alliancePhaseStarted(
      questId,
      'Pirates ahead. Choose your allies wisely.',
      ['ironveil', 'ashfall', 'meridian', 'void_wardens', 'sundered_oath']
    )
  )

  return baseEvents
}

/**
 * Create events leading up to card selection phase
 */
export function createCardSelectionPhaseEvents(ownedCardCount: number, questId = 'quest_salvage_claim'): GameEvent[] {
  const baseEvents = createAlliancePhaseEvents(ownedCardCount - 1, questId) // -1 because quest adds 1

  // Skip alliance (decline)
  baseEvents.push(
    events.phaseChanged('alliance', 'card_selection'),
    events.battleTriggered('battle-1', questId, 'Scavenger attack')
  )

  return baseEvents
}

// ----------------------------------------------------------------------------
// Assertions
// ----------------------------------------------------------------------------

/**
 * Assert that state has a specific number of owned cards
 */
export function assertCardCount(state: GameState, expectedCount: number): void {
  expect(state.ownedCards.length).toBe(expectedCount)
}

/**
 * Assert that a specific event type was generated
 */
export function assertEventGenerated(events: GameEvent[], eventType: string): void {
  const found = events.find(e => e.type === eventType)
  expect(found).toBeDefined()
}

/**
 * Assert that no event of a specific type was generated
 */
export function assertNoEvent(events: GameEvent[], eventType: string): void {
  const found = events.find(e => e.type === eventType)
  expect(found).toBeUndefined()
}

// Re-export for convenience
export { InvalidCommandError } from '../decider'
export { rebuildState, getInitialState } from '../projections'
