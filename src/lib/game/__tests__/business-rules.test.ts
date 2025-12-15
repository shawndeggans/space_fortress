// ============================================================================
// SPACE FORTRESS - Business Rules Tests
// ============================================================================
//
// Tests for business invariants defined in docs/design/GAME-RULES.md
// Using Given-When-Then format from event modeling
//
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest'
import {
  testDecider,
  expectError,
  expectEvents,
  expectContains,
  events,
  commands,
  createGameStartEvents,
  createAlliancePhaseEvents,
  createCardSelectionPhaseEvents,
  resetTimestamps,
  rebuildState,
  InvalidCommandError
} from './testHelpers'
import { decide } from '../decider'
import { projectCardPoolView } from '../projections/cardPool'
import { projectAllianceOptions } from '../projections/allianceView'

beforeEach(() => {
  resetTimestamps()
})

// ============================================================================
// CRITICAL INVARIANT 1: Minimum Card Guarantee
// ============================================================================
// Rule: Player cannot enter battle with fewer than 5 selectable cards
// This prevents the deadlock where player is stuck at "Select Your Fleet"

describe('INVARIANT: Minimum Card Guarantee', () => {

  describe('RULE: Cannot proceed alone with insufficient cards', () => {

    it('GIVEN: Player has only 3 owned cards (starter cards), WHEN: DECLINE_ALL_ALLIANCES, THEN: should block or warn', () => {
      // Setup: Game started with 3 starter cards, in alliance phase
      // Note: Quest acceptance doesn't automatically grant cards in this flow
      const givenEvents = [
        ...createGameStartEvents(), // 3 starter cards
        events.questAccepted('quest_salvage_claim', 'ironveil', 500),
        events.phaseChanged('narrative', 'alliance'),
        events.alliancePhaseStarted(
          'quest_salvage_claim',
          'Pirates ahead',
          ['ironveil', 'ashfall', 'meridian', 'void_wardens', 'sundered_oath']
        )
      ]

      const state = rebuildState(givenEvents)

      // Verify precondition: player has exactly 3 cards
      expect(state.ownedCards.length).toBe(3)

      // DECLINE_ALL_ALLIANCES should fail when player has < 5 cards
      const result = () => decide(commands.declineAllAlliances(), state)

      // Should throw an error guiding player to form alliance
      expect(result).toThrow(InvalidCommandError)
      expect(result).toThrow('Cannot proceed without allies')
    })

    it('GIVEN: Player has 5+ cards, WHEN: DECLINE_ALL_ALLIANCES, THEN: should succeed', () => {
      // Setup: 3 starter + 2 quest/choice cards = 5 total
      const givenEvents = [
        ...createGameStartEvents(), // 3 cards
        events.questAccepted('quest_salvage_claim', 'ironveil', 500),
        events.cardGained('quest_card_1', 'ironveil', 'quest'), // 4 cards
        events.cardGained('quest_card_2', 'ironveil', 'quest'), // 5 cards
        events.phaseChanged('narrative', 'alliance'),
        events.alliancePhaseStarted(
          'quest_salvage_claim',
          'Pirates ahead',
          ['ironveil', 'ashfall', 'meridian', 'void_wardens', 'sundered_oath']
        )
      ]

      const state = rebuildState(givenEvents)

      // Verify precondition
      expect(state.ownedCards.length).toBe(5)

      // Should succeed
      const result = decide(commands.declineAllAlliances(), state)
      expect(result.some(e => e.type === 'ALLIANCES_DECLINED')).toBe(true)
    })

    it('GIVEN: Player has 3 cards + alliance provides 2, WHEN: FORM_ALLIANCE, THEN: should succeed (total 5 cards)', () => {
      const givenEvents = [
        ...createGameStartEvents(), // 3 cards
        events.questAccepted('quest_salvage_claim', 'ironveil', 500),
        events.phaseChanged('narrative', 'alliance'),
        events.alliancePhaseStarted(
          'quest_salvage_claim',
          'Pirates ahead',
          ['ironveil', 'ashfall', 'meridian', 'void_wardens', 'sundered_oath']
        )
      ]

      const state = rebuildState(givenEvents)
      expect(state.ownedCards.length).toBe(3)

      // Forming alliance should succeed and provide 2 cards
      const result = decide(commands.formAlliance('ironveil'), state)
      expect(result.some(e => e.type === 'ALLIANCE_FORMED')).toBe(true)
    })
  })
})

// ============================================================================
// CRITICAL INVARIANT 2: Alliance Cards in Pool
// ============================================================================
// Rule: When alliance is formed, alliance cards must be available for selection

describe('INVARIANT: Alliance Cards Available in Card Pool', () => {

  it('GIVEN: Alliance formed with ironveil, WHEN: projecting card pool, THEN: should include alliance cards', () => {
    const givenEvents = [
      ...createGameStartEvents(), // 3 cards
      events.questAccepted('quest_salvage_claim', 'ironveil', 500),
      events.phaseChanged('narrative', 'alliance'),
      events.allianceFormed('ironveil', 0.30, ['ironveil_ship_alpha', 'ironveil_ship_beta']),
      events.cardGained('ironveil_ship_alpha', 'ironveil', 'alliance'),
      events.cardGained('ironveil_ship_beta', 'ironveil', 'alliance'),
      events.phaseChanged('alliance', 'card_selection'),
      events.battleTriggered('battle-1', 'quest_salvage_claim', 'Scavenger attack')
    ]

    const cardPoolView = projectCardPoolView(givenEvents)

    // Should have 3 starter + 2 alliance = 5 cards
    expect(cardPoolView.totalCards).toBe(5)
    expect(cardPoolView.allCards.some(c => c.id === 'ironveil_ship_alpha')).toBe(true)
    expect(cardPoolView.allCards.some(c => c.id === 'ironveil_ship_beta')).toBe(true)
  })

  it('GIVEN: No alliance formed, WHEN: projecting card pool, THEN: should only show owned cards', () => {
    const givenEvents = [
      ...createGameStartEvents(), // 3 cards
      events.questAccepted('quest_salvage_claim', 'ironveil', 500),
      events.cardGained('quest_card_1', 'ironveil', 'quest'), // 4 cards
      events.phaseChanged('alliance', 'card_selection'),
      events.battleTriggered('battle-1', 'quest_salvage_claim', 'Scavenger attack')
    ]

    const cardPoolView = projectCardPoolView(givenEvents)

    // Should have 3 starter + 1 quest = 4 cards (not enough for battle!)
    expect(cardPoolView.totalCards).toBe(4)
  })
})

// ============================================================================
// CRITICAL INVARIANT 3: Safe Card Loss
// ============================================================================
// Rule: Choices cannot reduce card count below 5 if battle is upcoming

describe('INVARIANT: Safe Card Loss', () => {

  it('documents current behavior: choice can cause card shortage', () => {
    // This test documents that card loss is currently NOT validated
    // The fix will add validation to prevent this

    const givenEvents = [
      ...createGameStartEvents(), // 3 cards
      events.questAccepted('quest_salvage_claim', 'ironveil', 500),
      events.cardGained('quest_card_1', 'ironveil', 'quest'), // 4 cards
      events.cardGained('quest_card_2', 'ironveil', 'quest'), // 5 cards
      events.phaseChanged('quest_hub', 'narrative'),
      events.dilemmaPresented('dilemma_1', 'quest_salvage_claim')
    ]

    const state = rebuildState(givenEvents)
    expect(state.ownedCards.length).toBe(5)

    // Currently, MAKE_CHOICE doesn't validate card balance
    // After fix: choices that would reduce cards below 5 (with battle upcoming)
    // should either be blocked or show a warning in the UI
  })
})

// ============================================================================
// RULE: Commit Fleet Requires Exactly 5 Cards
// ============================================================================

describe('RULE: Commit Fleet Requires 5 Cards', () => {

  it('GIVEN: 4 cards owned, WHEN: COMMIT_FLEET with 4, THEN: should throw error', () => {
    const givenEvents = [
      ...createGameStartEvents(),  // 3 starter cards
      events.questAccepted('quest_salvage_claim', 'ironveil', 500),
      events.cardGained('extra_card_1', 'ironveil', 'quest'),  // 4 cards total
      events.phaseChanged('alliance', 'card_selection'),
      events.battleTriggered('battle-1', 'quest_salvage_claim', 'Scavenger attack')
    ]

    testDecider({
      given: givenEvents,
      when: commands.commitFleet(['starter_scout', 'starter_freighter', 'starter_corvette', 'extra_card_1']),
      then: expectError('Must select exactly 5 cards')
    })
  })

  it('GIVEN: 5 cards owned, WHEN: COMMIT_FLEET with 5, THEN: should succeed', () => {
    const givenEvents = [
      ...createGameStartEvents(),  // 3 starter cards
      events.questAccepted('quest_salvage_claim', 'ironveil', 500),
      events.cardGained('extra_card_1', 'ironveil', 'quest'),
      events.cardGained('extra_card_2', 'ironveil', 'alliance'),  // 5 cards total
      events.phaseChanged('alliance', 'card_selection'),
      events.battleTriggered('battle-1', 'quest_salvage_claim', 'Scavenger attack')
    ]

    testDecider({
      given: givenEvents,
      when: commands.commitFleet([
        'starter_scout',
        'starter_freighter',
        'starter_corvette',
        'extra_card_1',
        'extra_card_2'
      ]),
      then: expectContains('FLEET_COMMITTED')
    })
  })

  it('GIVEN: 6 cards owned, WHEN: COMMIT_FLEET with 5, THEN: should succeed', () => {
    const givenEvents = [
      ...createGameStartEvents(),  // 3 starter cards
      events.questAccepted('quest_salvage_claim', 'ironveil', 500),
      events.cardGained('extra_card_1', 'ironveil', 'quest'),
      events.cardGained('extra_card_2', 'ironveil', 'alliance'),
      events.cardGained('extra_card_3', 'ironveil', 'alliance'),  // 6 cards total
      events.phaseChanged('alliance', 'card_selection'),
      events.battleTriggered('battle-1', 'quest_salvage_claim', 'Scavenger attack')
    ]

    testDecider({
      given: givenEvents,
      when: commands.commitFleet([
        'starter_scout',
        'starter_freighter',
        'starter_corvette',
        'extra_card_1',
        'extra_card_2'
        // extra_card_3 not selected - that's fine
      ]),
      then: expectContains('FLEET_COMMITTED')
    })
  })
})

// ============================================================================
// RULE: Select Card Validation
// ============================================================================

describe('RULE: Select Card Validation', () => {

  it('GIVEN: Card not owned, WHEN: SELECT_CARD, THEN: should throw error', () => {
    const givenEvents = [
      ...createGameStartEvents(),
      events.phaseChanged('alliance', 'card_selection'),
      events.battleTriggered('battle-1', 'quest_salvage_claim', 'Scavenger attack')
    ]

    testDecider({
      given: givenEvents,
      when: commands.selectCard('nonexistent_card'),
      then: expectError()
    })
  })

  it('GIVEN: Card already selected, WHEN: SELECT_CARD same card, THEN: should throw error', () => {
    const givenEvents = [
      ...createGameStartEvents(),
      events.phaseChanged('alliance', 'card_selection'),
      events.battleTriggered('battle-1', 'quest_salvage_claim', 'Scavenger attack'),
      events.cardSelected('starter_scout', 'battle-1')
    ]

    testDecider({
      given: givenEvents,
      when: commands.selectCard('starter_scout'),
      then: expectError('already selected')
    })
  })

  it('GIVEN: 5 cards already selected, WHEN: SELECT_CARD 6th card, THEN: should throw error', () => {
    const givenEvents = [
      ...createGameStartEvents(), // 3 cards
      events.cardGained('extra_card_1', 'ironveil', 'quest'),
      events.cardGained('extra_card_2', 'ironveil', 'quest'),
      events.cardGained('extra_card_3', 'ironveil', 'quest'), // 6 cards total
      events.phaseChanged('alliance', 'card_selection'),
      events.battleTriggered('battle-1', 'quest_salvage_claim', 'Scavenger attack'),
      events.cardSelected('starter_scout', 'battle-1'),
      events.cardSelected('starter_freighter', 'battle-1'),
      events.cardSelected('starter_corvette', 'battle-1'),
      events.cardSelected('extra_card_1', 'battle-1'),
      events.cardSelected('extra_card_2', 'battle-1') // 5 selected
    ]

    testDecider({
      given: givenEvents,
      when: commands.selectCard('extra_card_3'),
      then: expectError('Already selected 5 cards')
    })
  })
})

// ============================================================================
// RULE: Alliance Formation
// ============================================================================

describe('RULE: Alliance Formation', () => {

  it('GIVEN: Faction is hostile (rep < -75), WHEN: FORM_ALLIANCE, THEN: should throw error', () => {
    const givenEvents = [
      ...createGameStartEvents(),
      events.reputationChanged('ironveil', -80, -80),
      events.questAccepted('quest_salvage_claim', 'ashfall', 500),
      events.phaseChanged('narrative', 'alliance'),
      events.alliancePhaseStarted('quest_salvage_claim', 'Battle ahead', ['ironveil', 'ashfall'])
    ]

    testDecider({
      given: givenEvents,
      when: commands.formAlliance('ironveil'),
      then: expectError('hostile')
    })
  })

  it('GIVEN: Faction is friendly (rep > 25), WHEN: FORM_ALLIANCE, THEN: should succeed with better terms', () => {
    const givenEvents = [
      ...createGameStartEvents(),
      events.reputationChanged('ironveil', 50, 50),
      events.questAccepted('quest_salvage_claim', 'ironveil', 500),
      events.phaseChanged('narrative', 'alliance'),
      events.alliancePhaseStarted('quest_salvage_claim', 'Battle ahead', ['ironveil', 'ashfall'])
    ]

    testDecider({
      given: givenEvents,
      when: commands.formAlliance('ironveil'),
      then: expectContains('ALLIANCE_FORMED')
    })
  })
})

// ============================================================================
// RULE: Game Start
// ============================================================================

describe('RULE: Game Start', () => {

  it('GIVEN: No game started, WHEN: START_GAME, THEN: should grant exactly 3 starter cards', () => {
    testDecider({
      given: [],
      when: commands.startGame('player-1'),
      then: expectContains('GAME_STARTED')
    })

    // Also verify card count through state
    const result = decide(commands.startGame('player-1'), rebuildState([]))
    const cardGainedEvents = result.filter(e => e.type === 'CARD_GAINED')
    // Game starts with 3 cards - need quest + alliance to reach 5 for battle
    expect(cardGainedEvents.length).toBe(3)
  })

  it('GIVEN: Game already started, WHEN: START_GAME, THEN: should throw error', () => {
    testDecider({
      given: createGameStartEvents(),
      when: commands.startGame('player-1'),
      then: expectError('already')
    })
  })
})

// ============================================================================
// RULE: Phase Gating
// ============================================================================

describe('RULE: Phase Gating', () => {

  it('GIVEN: Phase is quest_hub, WHEN: SELECT_CARD, THEN: should throw error (wrong phase)', () => {
    testDecider({
      given: createGameStartEvents(), // Phase is quest_hub
      when: commands.selectCard('starter_scout'),
      then: expectError()
    })
  })

  it('GIVEN: Phase is card_selection, WHEN: ACCEPT_QUEST, THEN: should throw error (wrong phase)', () => {
    const givenEvents = [
      ...createGameStartEvents(),
      events.questAccepted('quest_salvage_claim', 'ironveil', 500),
      events.phaseChanged('alliance', 'card_selection'),
      events.battleTriggered('battle-1', 'quest_salvage_claim', 'Scavenger attack')
    ]

    testDecider({
      given: givenEvents,
      when: commands.acceptQuest('quest_sanctuary_run'),
      then: expectError()
    })
  })
})

// ============================================================================
// UI GUIDANCE: Alliance Options View
// ============================================================================

describe('UI GUIDANCE: Alliance Options View', () => {

  it('GIVEN: Player has 3 cards, WHEN: projecting alliance options, THEN: canProceedAlone should be false', () => {
    const givenEvents = [
      ...createGameStartEvents(), // 3 cards
      events.questAccepted('quest_salvage_claim', 'ironveil', 500),
      events.phaseChanged('narrative', 'alliance'),
      events.alliancePhaseStarted('quest_salvage_claim', 'Battle ahead', ['ironveil', 'ashfall'])
    ]

    const view = projectAllianceOptions(givenEvents)

    // With only 3 cards, player cannot proceed alone (needs 5 for battle)
    expect(view?.canProceedAlone).toBe(false)
    expect(view?.needsAlliance).toBe(true)
    expect(view?.aloneBlockedReason).toContain('need 5 cards')
    expect(view?.ownedCardCount).toBe(3)
    expect(view?.requiredCardCount).toBe(5)
  })

  it('GIVEN: Player has 5+ cards, WHEN: projecting alliance options, THEN: canProceedAlone should be true', () => {
    const givenEvents = [
      ...createGameStartEvents(), // 3 cards
      events.cardGained('extra_card_1', 'ironveil', 'quest'), // 4 cards
      events.cardGained('extra_card_2', 'ironveil', 'quest'), // 5 cards
      events.questAccepted('quest_salvage_claim', 'ironveil', 500),
      events.phaseChanged('narrative', 'alliance'),
      events.alliancePhaseStarted('quest_salvage_claim', 'Battle ahead', ['ironveil', 'ashfall'])
    ]

    const view = projectAllianceOptions(givenEvents)
    expect(view?.canProceedAlone).toBe(true)
  })
})

// ============================================================================
// BUG-022: ActiveQuest Must Store factionId
// ============================================================================
// Rule: When a quest is accepted, the activeQuest state must include factionId

describe('BUG-022: ActiveQuest stores factionId', () => {

  it('GIVEN: Game started, WHEN: QUEST_ACCEPTED with factionId, THEN: activeQuest.factionId should be set', () => {
    const givenEvents = [
      ...createGameStartEvents(),
      events.questAccepted('quest_salvage_claim', 'ironveil', 500)
    ]

    const state = rebuildState(givenEvents)

    expect(state.activeQuest).not.toBeNull()
    expect(state.activeQuest?.questId).toBe('quest_salvage_claim')
    expect(state.activeQuest?.factionId).toBe('ironveil')
  })

  it('GIVEN: Quest accepted from different faction, WHEN: checking state, THEN: correct factionId stored', () => {
    const givenEvents = [
      ...createGameStartEvents(),
      events.questAccepted('quest_sanctuary_run', 'ashfall', 750)
    ]

    const state = rebuildState(givenEvents)

    expect(state.activeQuest?.factionId).toBe('ashfall')
  })
})
