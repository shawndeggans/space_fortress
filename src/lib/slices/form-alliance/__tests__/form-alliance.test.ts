// ============================================================================
// FORM-ALLIANCE SLICE - Tests
// ============================================================================
//
// Given-When-Then tests for the form-alliance slice following the
// specifications in SLICE-03-FORM-ALLIANCE.md
// ============================================================================

import { describe, it, expect } from 'vitest'
import {
  handleFormAlliance,
  handleFinalizeAlliances,
  handleDeclineAllAlliances,
  handleRejectAllianceTerms,
  createFormAllianceCommand,
  createFinalizeAlliancesCommand,
  createDeclineAllAlliancesCommand,
  AllianceError,
  type AllianceState,
  createAllianceProjection,
  buildAllianceOptionsView,
  buildAllianceTermsView,
  projectAllianceOptionsFromEvents
} from '../index'
import type { GameEvent, FactionId } from '../../shared-kernel'
import { createTimestamp } from '../../shared-kernel'

// ----------------------------------------------------------------------------
// Test Fixtures
// ----------------------------------------------------------------------------

function createAlliancePhaseState(overrides?: Partial<AllianceState>): AllianceState {
  return {
    gameStatus: 'in_progress',
    currentPhase: 'alliance',
    activeQuest: { questId: 'quest_salvage_claim' },
    reputation: {
      ironveil: 0,
      ashfall: 0,
      meridian: 0,
      void_wardens: 0,
      sundered_oath: 0
    },
    ownedCardCount: 5,
    ...overrides
  }
}

function createStateWithHostileFaction(): AllianceState {
  return {
    gameStatus: 'in_progress',
    currentPhase: 'alliance',
    activeQuest: { questId: 'quest_salvage_claim' },
    reputation: {
      ironveil: -80,
      ashfall: 0,
      meridian: 0,
      void_wardens: 0,
      sundered_oath: 0
    },
    ownedCardCount: 5
  }
}

function createStateWithFriendlyFaction(): AllianceState {
  return {
    gameStatus: 'in_progress',
    currentPhase: 'alliance',
    activeQuest: { questId: 'quest_salvage_claim' },
    reputation: {
      ironveil: 50,
      ashfall: 0,
      meridian: 0,
      void_wardens: 0,
      sundered_oath: 0
    },
    ownedCardCount: 5
  }
}

function createStateWithInsufficientCards(): AllianceState {
  return {
    gameStatus: 'in_progress',
    currentPhase: 'alliance',
    activeQuest: { questId: 'quest_salvage_claim' },
    reputation: {
      ironveil: 0,
      ashfall: 0,
      meridian: 0,
      void_wardens: 0,
      sundered_oath: 0
    },
    ownedCardCount: 4
  }
}

function createStateNotInAlliancePhase(): AllianceState {
  return {
    gameStatus: 'in_progress',
    currentPhase: 'narrative',
    activeQuest: { questId: 'quest_salvage_claim' },
    reputation: {
      ironveil: 0,
      ashfall: 0,
      meridian: 0,
      void_wardens: 0,
      sundered_oath: 0
    },
    ownedCardCount: 5
  }
}

// ----------------------------------------------------------------------------
// Command Handler Tests
// ----------------------------------------------------------------------------

describe('Form Alliance Command Handler', () => {
  describe('Spec 1: Form Alliance with Neutral/Friendly Faction', () => {
    it('should emit ALLIANCE_FORMED and CARD_GAINED events when forming alliance', () => {
      // Given: Player in alliance phase with neutral reputation
      const state = createAlliancePhaseState()

      // When: Player forms alliance with ironveil
      const command = createFormAllianceCommand('ironveil')
      const events = handleFormAlliance(command, state)

      // Then: ALLIANCE_FORMED event is emitted
      expect(events.length).toBeGreaterThanOrEqual(1)
      expect(events[0].type).toBe('ALLIANCE_FORMED')
      expect(events[0].data).toMatchObject({
        factionId: 'ironveil',
        bountyShare: 0.30,
        isSecret: false
      })
    })

    it('should emit CARD_GAINED events for 2 faction cards', () => {
      // Given: Player in alliance phase
      const state = createAlliancePhaseState()

      // When: Player forms alliance
      const command = createFormAllianceCommand('ironveil')
      const events = handleFormAlliance(command, state)

      // Then: 2 CARD_GAINED events are emitted
      const cardEvents = events.filter(e => e.type === 'CARD_GAINED')
      expect(cardEvents).toHaveLength(2)
      expect(cardEvents[0].data).toMatchObject({
        factionId: 'ironveil',
        source: 'alliance'
      })
    })

    it('should give better bounty share to friendly factions', () => {
      // Given: Player with friendly reputation
      const state = createStateWithFriendlyFaction()

      // When: Player forms alliance
      const command = createFormAllianceCommand('ironveil')
      const events = handleFormAlliance(command, state)

      // Then: Bounty share is 25% (friendly rate)
      const allianceEvent = events.find(e => e.type === 'ALLIANCE_FORMED')
      expect((allianceEvent as any).data.bountyShare).toBe(0.25)
    })
  })

  describe('Spec 2: Cannot Ally with Hostile Faction', () => {
    it('should throw error when faction is hostile', () => {
      // Given: Player with hostile reputation (-80) with ironveil
      const state = createStateWithHostileFaction()

      // When/Then: Attempting to ally throws error
      const command = createFormAllianceCommand('ironveil')

      expect(() => handleFormAlliance(command, state)).toThrow(AllianceError)
      expect(() => handleFormAlliance(command, state)).toThrow('hostile')
    })
  })

  describe('Spec 3: Finalize Alliances (Proceed to Battle)', () => {
    it('should emit BATTLE_TRIGGERED and PHASE_CHANGED when finalizing', () => {
      // Given: Player with 5+ cards
      const state = createAlliancePhaseState({ ownedCardCount: 6 })

      // When: Player finalizes alliances
      const command = createFinalizeAlliancesCommand()
      const events = handleFinalizeAlliances(command, state)

      // Then: BATTLE_TRIGGERED and PHASE_CHANGED are emitted
      expect(events).toHaveLength(2)
      expect(events[0].type).toBe('BATTLE_TRIGGERED')
      expect(events[1].type).toBe('PHASE_CHANGED')
      expect((events[1] as any).data.toPhase).toBe('card_selection')
    })
  })

  describe('Spec 4: Cannot Finalize with Insufficient Cards', () => {
    it('should throw error when player has less than 5 cards', () => {
      // Given: Player with only 4 cards
      const state = createStateWithInsufficientCards()

      // When/Then: Attempting to finalize throws error
      const command = createFinalizeAlliancesCommand()

      expect(() => handleFinalizeAlliances(command, state)).toThrow(AllianceError)
      expect(() => handleFinalizeAlliances(command, state)).toThrow('Need 5 cards')
    })
  })

  describe('Decline All Alliances', () => {
    it('should emit ALLIANCES_DECLINED, BATTLE_TRIGGERED, PHASE_CHANGED', () => {
      // Given: Player with 5+ cards
      const state = createAlliancePhaseState({ ownedCardCount: 5 })

      // When: Player declines all alliances
      const command = createDeclineAllAlliancesCommand()
      const events = handleDeclineAllAlliances(command, state)

      // Then: Three events emitted
      expect(events).toHaveLength(3)
      expect(events[0].type).toBe('ALLIANCES_DECLINED')
      expect(events[1].type).toBe('BATTLE_TRIGGERED')
      expect(events[2].type).toBe('PHASE_CHANGED')
    })

    it('should throw error when declining with insufficient cards', () => {
      // Given: Player with only 4 cards
      const state = createStateWithInsufficientCards()

      // When/Then: Attempting to decline throws error
      const command = createDeclineAllAlliancesCommand()

      expect(() => handleDeclineAllAlliances(command, state)).toThrow(AllianceError)
      expect(() => handleDeclineAllAlliances(command, state)).toThrow('Cannot proceed without allies')
    })
  })

  describe('Phase Validation', () => {
    it('should throw error when not in alliance phase', () => {
      // Given: Player not in alliance phase
      const state = createStateNotInAlliancePhase()

      // When/Then: Attempting to form alliance throws
      const command = createFormAllianceCommand('ironveil')

      expect(() => handleFormAlliance(command, state)).toThrow(AllianceError)
      expect(() => handleFormAlliance(command, state)).toThrow('Not in alliance phase')
    })
  })

  describe('Reject Alliance Terms', () => {
    it('should emit ALLIANCE_REJECTED event', () => {
      const state = createAlliancePhaseState()
      const events = handleRejectAllianceTerms(
        { type: 'REJECT_ALLIANCE_TERMS', data: { factionId: 'ironveil' } },
        state
      )

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('ALLIANCE_REJECTED')
      expect((events[0] as any).data.factionId).toBe('ironveil')
    })
  })
})

// ----------------------------------------------------------------------------
// Read Model Tests
// ----------------------------------------------------------------------------

describe('Form Alliance Read Model', () => {
  describe('Alliance Options Projection', () => {
    it('should return null when no active quest', () => {
      const events: GameEvent[] = [
        {
          type: 'GAME_STARTED',
          data: {
            timestamp: createTimestamp(),
            playerId: 'player-1',
            starterCardIds: ['card-1']
          }
        }
      ]

      const view = projectAllianceOptionsFromEvents(events)

      expect(view).toBeNull()
    })

    it('should show all factions as available with neutral reputation', () => {
      const events: GameEvent[] = [
        {
          type: 'GAME_STARTED',
          data: {
            timestamp: createTimestamp(),
            playerId: 'player-1',
            starterCardIds: ['card-1', 'card-2', 'card-3', 'card-4', 'card-5']
          }
        },
        {
          type: 'QUEST_ACCEPTED',
          data: {
            timestamp: createTimestamp(),
            questId: 'quest_salvage_claim',
            factionId: 'ironveil',
            initialBounty: 500,
            initialCardIds: []
          }
        },
        {
          type: 'PHASE_CHANGED',
          data: {
            timestamp: createTimestamp(),
            fromPhase: 'narrative',
            toPhase: 'alliance'
          }
        }
      ]

      const view = projectAllianceOptionsFromEvents(events)

      expect(view).not.toBeNull()
      expect(view!.options.length).toBeGreaterThan(0)
      // With neutral reputation, all should be available
      const availableOptions = view!.options.filter(o => o.available)
      expect(availableOptions.length).toBe(5)
    })

    it('should mark hostile faction as unavailable', () => {
      const events: GameEvent[] = [
        {
          type: 'GAME_STARTED',
          data: {
            timestamp: createTimestamp(),
            playerId: 'player-1',
            starterCardIds: ['card-1', 'card-2', 'card-3', 'card-4', 'card-5']
          }
        },
        {
          type: 'QUEST_ACCEPTED',
          data: {
            timestamp: createTimestamp(),
            questId: 'quest_salvage_claim',
            factionId: 'ironveil',
            initialBounty: 500,
            initialCardIds: []
          }
        },
        {
          type: 'REPUTATION_CHANGED',
          data: {
            timestamp: createTimestamp(),
            factionId: 'ashfall',
            delta: -80,
            newValue: -80,
            source: 'choice'
          }
        }
      ]

      const view = projectAllianceOptionsFromEvents(events)

      expect(view).not.toBeNull()
      const ashfallOption = view!.options.find(o => o.factionId === 'ashfall')
      expect(ashfallOption?.available).toBe(false)
      expect(ashfallOption?.unavailableReason).toContain("don't work with your kind")
    })

    it('should track formed alliances', () => {
      const events: GameEvent[] = [
        {
          type: 'GAME_STARTED',
          data: {
            timestamp: createTimestamp(),
            playerId: 'player-1',
            starterCardIds: ['card-1', 'card-2', 'card-3']
          }
        },
        {
          type: 'QUEST_ACCEPTED',
          data: {
            timestamp: createTimestamp(),
            questId: 'quest_salvage_claim',
            factionId: 'ironveil',
            initialBounty: 500,
            initialCardIds: []
          }
        },
        {
          type: 'ALLIANCE_FORMED',
          data: {
            timestamp: createTimestamp(),
            factionId: 'ironveil',
            bountyShare: 0.30,
            cardIdsProvided: ['card-a', 'card-b'],
            isSecret: false
          }
        },
        {
          type: 'CARD_GAINED',
          data: {
            timestamp: createTimestamp(),
            cardId: 'card-a',
            factionId: 'ironveil',
            source: 'alliance'
          }
        },
        {
          type: 'CARD_GAINED',
          data: {
            timestamp: createTimestamp(),
            cardId: 'card-b',
            factionId: 'ironveil',
            source: 'alliance'
          }
        }
      ]

      const view = projectAllianceOptionsFromEvents(events)

      expect(view).not.toBeNull()
      expect(view!.allianceCount).toBe(1)
      expect(view!.alliedFactionIds).toContain('ironveil')
      expect(view!.hasSelectedAlliance).toBe(true)
      // Ironveil should now show as already allied
      const ironveilOption = view!.options.find(o => o.factionId === 'ironveil')
      expect(ironveilOption?.isAllied).toBe(true)
      expect(ironveilOption?.available).toBe(false)
    })

    it('should calculate card requirements correctly', () => {
      const events: GameEvent[] = [
        {
          type: 'GAME_STARTED',
          data: {
            timestamp: createTimestamp(),
            playerId: 'player-1',
            starterCardIds: ['card-1', 'card-2', 'card-3'] // Only 3 cards
          }
        },
        {
          type: 'QUEST_ACCEPTED',
          data: {
            timestamp: createTimestamp(),
            questId: 'quest_salvage_claim',
            factionId: 'ironveil',
            initialBounty: 500,
            initialCardIds: []
          }
        }
      ]

      const view = projectAllianceOptionsFromEvents(events)

      expect(view).not.toBeNull()
      expect(view!.ownedCardCount).toBe(3)
      expect(view!.requiredCardCount).toBe(5)
      expect(view!.needsAlliance).toBe(true)
      expect(view!.canProceedAlone).toBe(false)
      expect(view!.canContinue).toBe(false)
      expect(view!.aloneBlockedReason).toContain('need 5 cards')
    })
  })

  describe('Alliance Terms View', () => {
    it('should build alliance terms for a faction', () => {
      const projection = createAllianceProjection()
      projection.rebuildFrom([
        {
          type: 'GAME_STARTED',
          data: {
            timestamp: createTimestamp(),
            playerId: 'player-1',
            starterCardIds: ['card-1']
          }
        }
      ])

      const state = projection.getState()
      const view = buildAllianceTermsView(state, 'ironveil')

      expect(view).not.toBeNull()
      expect(view!.factionId).toBe('ironveil')
      expect(view!.representativeName).toBe('Castellan Vorn')
      expect(view!.bountyShare).toBe(30)
      expect(view!.cardsProvided).toHaveLength(2)
      expect(view!.canAccept).toBe(true)
    })

    it('should mark terms as unacceptable for hostile faction', () => {
      const projection = createAllianceProjection()
      projection.rebuildFrom([
        {
          type: 'GAME_STARTED',
          data: {
            timestamp: createTimestamp(),
            playerId: 'player-1',
            starterCardIds: ['card-1']
          }
        },
        {
          type: 'REPUTATION_CHANGED',
          data: {
            timestamp: createTimestamp(),
            factionId: 'ironveil',
            delta: -80,
            newValue: -80,
            source: 'choice'
          }
        }
      ])

      const state = projection.getState()
      const view = buildAllianceTermsView(state, 'ironveil')

      expect(view).not.toBeNull()
      expect(view!.canAccept).toBe(false)
      expect(view!.rejectReason).toContain('hostile')
    })
  })
})

// ----------------------------------------------------------------------------
// Integration Tests
// ----------------------------------------------------------------------------

describe('Form Alliance Integration', () => {
  it('should produce events that update read model correctly', () => {
    // Start with state ready for alliance
    const commandState = createAlliancePhaseState({ ownedCardCount: 3 })
    const command = createFormAllianceCommand('ironveil')

    // Execute command
    const producedEvents = handleFormAlliance(command, commandState)

    // Feed events to projection
    const allEvents: GameEvent[] = [
      {
        type: 'GAME_STARTED',
        data: {
          timestamp: createTimestamp(),
          playerId: 'player-1',
          starterCardIds: ['card-1', 'card-2', 'card-3']
        }
      },
      {
        type: 'QUEST_ACCEPTED',
        data: {
          timestamp: createTimestamp(),
          questId: 'quest_salvage_claim',
          factionId: 'ironveil',
          initialBounty: 500,
          initialCardIds: []
        }
      },
      ...producedEvents
    ]

    const view = projectAllianceOptionsFromEvents(allEvents)

    // Verify alliance is tracked
    expect(view!.allianceCount).toBe(1)
    expect(view!.alliedFactionIds).toContain('ironveil')
    // Should now have 5 cards (3 starter + 2 alliance)
    expect(view!.ownedCardCount).toBe(5)
    expect(view!.canContinue).toBe(true)
  })
})
