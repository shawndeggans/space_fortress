// ============================================================================
// MEDIATION SLICE - Tests
// ============================================================================
//
// Tests for the mediation command handlers and read model.
// Uses Given-When-Then pattern.
// ============================================================================

import { describe, it, expect } from 'vitest'
import type { GameEvent } from '../../../game/events'
import type { FactionId } from '../../../game/types'
import {
  handleLeanTowardFaction,
  handleRefuseToLean,
  handleAcceptCompromise,
  createLeanTowardFactionCommand,
  createRefuseToLeanCommand,
  createAcceptCompromiseCommand,
  MediationError,
  type MediationState
} from '../command'
import {
  createMediationProjection,
  buildMediationStateView,
  projectMediationStateFromEvents
} from '../read-model'

// ----------------------------------------------------------------------------
// Test Helpers
// ----------------------------------------------------------------------------

function timestamp(): string {
  return new Date().toISOString()
}

function createMediationState(overrides: Partial<MediationState> = {}): MediationState {
  return {
    currentPhase: 'mediation',
    currentMediationId: 'mediation-1',
    mediationParties: ['ironveil', 'ashfall'],
    hasLeaned: false,
    leanedToward: null,
    ...overrides
  }
}

function createMediationStartedEvent(
  mediationId = 'mediation-1',
  questId = 'quest-1',
  parties: [FactionId, FactionId] = ['ironveil', 'ashfall']
): GameEvent {
  return {
    type: 'MEDIATION_STARTED',
    data: {
      timestamp: timestamp(),
      mediationId,
      questId,
      facilitatorFactionId: 'meridian',
      partyFactionIds: parties
    }
  }
}

function createMediationLeanedEvent(
  towardFactionId: FactionId = 'ironveil',
  awayFromFactionId: FactionId = 'ashfall'
): GameEvent {
  return {
    type: 'MEDIATION_LEANED',
    data: {
      timestamp: timestamp(),
      towardFactionId,
      awayFromFactionId
    }
  }
}

function createMediationCollapsedEvent(): GameEvent {
  return {
    type: 'MEDIATION_COLLAPSED',
    data: {
      timestamp: timestamp(),
      reason: 'Player refused to lean',
      battleTriggered: true
    }
  }
}

function createCompromiseAcceptedEvent(): GameEvent {
  return {
    type: 'COMPROMISE_ACCEPTED',
    data: {
      timestamp: timestamp(),
      terms: 'Diplomatic resolution',
      bountyModifier: 0.5
    }
  }
}

// ----------------------------------------------------------------------------
// Command Handler Tests
// ----------------------------------------------------------------------------

describe('Mediation Command Handlers', () => {
  describe('LEAN_TOWARD_FACTION', () => {
    it('emits MEDIATION_LEANED event when valid', () => {
      // Given: in mediation phase, not yet leaned
      const state = createMediationState()
      const command = createLeanTowardFactionCommand('ironveil')

      // When: lean toward ironveil
      const events = handleLeanTowardFaction(command, state)

      // Then: MEDIATION_LEANED emitted
      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('MEDIATION_LEANED')
      const leanEvent = events[0] as { type: 'MEDIATION_LEANED'; data: { towardFactionId: FactionId; awayFromFactionId: FactionId } }
      expect(leanEvent.data.towardFactionId).toBe('ironveil')
      expect(leanEvent.data.awayFromFactionId).toBe('ashfall')
    })

    it('determines away faction from mediation parties', () => {
      // Given: mediation between meridian and void_wardens
      const state = createMediationState({
        mediationParties: ['meridian', 'void_wardens']
      })
      const command = createLeanTowardFactionCommand('void_wardens')

      // When: lean toward void_wardens
      const events = handleLeanTowardFaction(command, state)

      // Then: away faction is meridian
      const leanEvent = events[0] as { type: 'MEDIATION_LEANED'; data: { towardFactionId: FactionId; awayFromFactionId: FactionId } }
      expect(leanEvent.data.towardFactionId).toBe('void_wardens')
      expect(leanEvent.data.awayFromFactionId).toBe('meridian')
    })

    it('rejects if not in mediation phase', () => {
      // Given: in alliance phase
      const state = createMediationState({ currentPhase: 'alliance' })
      const command = createLeanTowardFactionCommand('ironveil')

      // When/Then: error thrown
      expect(() => handleLeanTowardFaction(command, state))
        .toThrow(MediationError)
      expect(() => handleLeanTowardFaction(command, state))
        .toThrow('Not in mediation phase')
    })

    it('rejects if already leaned', () => {
      // Given: already leaned
      const state = createMediationState({
        hasLeaned: true,
        leanedToward: 'ironveil'
      })
      const command = createLeanTowardFactionCommand('ashfall')

      // When/Then: error thrown
      expect(() => handleLeanTowardFaction(command, state))
        .toThrow(MediationError)
      expect(() => handleLeanTowardFaction(command, state))
        .toThrow('Already leaned toward a faction')
    })

    it('falls back to default faction pair when parties not specified', () => {
      // Given: no parties specified
      const state = createMediationState({ mediationParties: null })
      const command = createLeanTowardFactionCommand('ironveil')

      // When: lean toward ironveil
      const events = handleLeanTowardFaction(command, state)

      // Then: defaults to ashfall as away faction
      expect(events[0].data.awayFromFactionId).toBe('ashfall')
    })
  })

  describe('REFUSE_TO_LEAN', () => {
    it('emits MEDIATION_COLLAPSED and PHASE_CHANGED events', () => {
      // Given: in mediation phase
      const state = createMediationState()
      const command = createRefuseToLeanCommand()

      // When: refuse to lean
      const events = handleRefuseToLean(command, state)

      // Then: both events emitted
      expect(events).toHaveLength(2)
      expect(events[0].type).toBe('MEDIATION_COLLAPSED')
      expect(events[0].data.battleTriggered).toBe(true)
      expect(events[1].type).toBe('PHASE_CHANGED')
      expect(events[1].data.fromPhase).toBe('mediation')
      expect(events[1].data.toPhase).toBe('card_selection')
    })

    it('rejects if not in mediation phase', () => {
      // Given: in consequence phase
      const state = createMediationState({ currentPhase: 'consequence' })
      const command = createRefuseToLeanCommand()

      // When/Then: error thrown
      expect(() => handleRefuseToLean(command, state))
        .toThrow(MediationError)
      expect(() => handleRefuseToLean(command, state))
        .toThrow('Not in mediation phase')
    })
  })

  describe('ACCEPT_COMPROMISE', () => {
    it('emits COMPROMISE_ACCEPTED and PHASE_CHANGED events', () => {
      // Given: in mediation phase, has leaned
      const state = createMediationState({
        hasLeaned: true,
        leanedToward: 'ironveil'
      })
      const command = createAcceptCompromiseCommand()

      // When: accept compromise
      const events = handleAcceptCompromise(command, state)

      // Then: both events emitted
      expect(events).toHaveLength(2)
      expect(events[0].type).toBe('COMPROMISE_ACCEPTED')
      expect(events[0].data.bountyModifier).toBe(0.5)
      expect(events[1].type).toBe('PHASE_CHANGED')
      expect(events[1].data.fromPhase).toBe('mediation')
      expect(events[1].data.toPhase).toBe('consequence')
    })

    it('rejects if not in mediation phase', () => {
      // Given: in battle phase
      const state = createMediationState({
        currentPhase: 'battle',
        hasLeaned: true
      })
      const command = createAcceptCompromiseCommand()

      // When/Then: error thrown
      expect(() => handleAcceptCompromise(command, state))
        .toThrow(MediationError)
      expect(() => handleAcceptCompromise(command, state))
        .toThrow('Not in mediation phase')
    })

    it('rejects if has not leaned', () => {
      // Given: has not leaned
      const state = createMediationState({ hasLeaned: false })
      const command = createAcceptCompromiseCommand()

      // When/Then: error thrown
      expect(() => handleAcceptCompromise(command, state))
        .toThrow(MediationError)
      expect(() => handleAcceptCompromise(command, state))
        .toThrow('Must lean toward a faction before accepting compromise')
    })
  })
})

// ----------------------------------------------------------------------------
// Command Factory Tests
// ----------------------------------------------------------------------------

describe('Command Factories', () => {
  it('creates LEAN_TOWARD_FACTION command', () => {
    const command = createLeanTowardFactionCommand('meridian')
    expect(command.type).toBe('LEAN_TOWARD_FACTION')
    expect(command.data.towardFactionId).toBe('meridian')
  })

  it('creates REFUSE_TO_LEAN command', () => {
    const command = createRefuseToLeanCommand()
    expect(command.type).toBe('REFUSE_TO_LEAN')
    expect(command.data).toEqual({})
  })

  it('creates ACCEPT_COMPROMISE command', () => {
    const command = createAcceptCompromiseCommand()
    expect(command.type).toBe('ACCEPT_COMPROMISE')
    expect(command.data).toEqual({})
  })
})

// ----------------------------------------------------------------------------
// Read Model Tests
// ----------------------------------------------------------------------------

describe('Mediation Read Model', () => {
  describe('Projection', () => {
    it('returns initial state when no mediation events', () => {
      // Given: no events
      const events: GameEvent[] = []

      // When: projecting
      const view = projectMediationStateFromEvents(events)

      // Then: initial state
      expect(view.mediationId).toBeNull()
      expect(view.isActive).toBe(false)
      expect(view.hasLeaned).toBe(false)
    })

    it('initializes from MEDIATION_STARTED', () => {
      // Given: mediation started
      const events: GameEvent[] = [
        createMediationStartedEvent('med-123', 'quest-456', ['meridian', 'void_wardens'])
      ]

      // When: projecting
      const view = projectMediationStateFromEvents(events)

      // Then: initialized
      expect(view.mediationId).toBe('med-123')
      expect(view.questId).toBe('quest-456')
      expect(view.parties).toEqual(['meridian', 'void_wardens'])
      expect(view.isActive).toBe(true)
      expect(view.hasLeaned).toBe(false)
    })

    it('tracks lean from MEDIATION_LEANED', () => {
      // Given: mediation with lean
      const events: GameEvent[] = [
        createMediationStartedEvent(),
        createMediationLeanedEvent('ironveil', 'ashfall')
      ]

      // When: projecting
      const view = projectMediationStateFromEvents(events)

      // Then: lean tracked
      expect(view.hasLeaned).toBe(true)
      expect(view.leanedToward).toBe('ironveil')
      expect(view.isActive).toBe(true)
    })

    it('tracks collapse from MEDIATION_COLLAPSED', () => {
      // Given: mediation collapsed
      const events: GameEvent[] = [
        createMediationStartedEvent(),
        createMediationCollapsedEvent()
      ]

      // When: projecting
      const view = projectMediationStateFromEvents(events)

      // Then: collapsed
      expect(view.isCollapsed).toBe(true)
      expect(view.isActive).toBe(false)
    })

    it('tracks resolution from COMPROMISE_ACCEPTED', () => {
      // Given: mediation resolved
      const events: GameEvent[] = [
        createMediationStartedEvent(),
        createMediationLeanedEvent(),
        createCompromiseAcceptedEvent()
      ]

      // When: projecting
      const view = projectMediationStateFromEvents(events)

      // Then: resolved
      expect(view.isResolved).toBe(true)
      expect(view.isActive).toBe(false)
    })
  })

  describe('View Builder', () => {
    it('calculates isActive correctly', () => {
      const { initialState, reducer } = createMediationProjection()

      // Not active when no mediation
      let state = initialState
      let view = buildMediationStateView(state)
      expect(view.isActive).toBe(false)

      // Active after mediation started
      state = reducer(state, createMediationStartedEvent())
      view = buildMediationStateView(state)
      expect(view.isActive).toBe(true)

      // Still active after lean
      state = reducer(state, createMediationLeanedEvent())
      view = buildMediationStateView(state)
      expect(view.isActive).toBe(true)

      // Not active after resolution
      state = reducer(state, createCompromiseAcceptedEvent())
      view = buildMediationStateView(state)
      expect(view.isActive).toBe(false)
    })
  })

  describe('Full Mediation Flow', () => {
    it('projects successful mediation flow', () => {
      // Given: full successful mediation
      const events: GameEvent[] = [
        createMediationStartedEvent('med-1', 'quest-1', ['ironveil', 'ashfall']),
        createMediationLeanedEvent('ironveil', 'ashfall'),
        createCompromiseAcceptedEvent()
      ]

      // When: projecting
      const view = projectMediationStateFromEvents(events)

      // Then: shows resolved state
      expect(view.mediationId).toBe('med-1')
      expect(view.hasLeaned).toBe(true)
      expect(view.leanedToward).toBe('ironveil')
      expect(view.isResolved).toBe(true)
      expect(view.isCollapsed).toBe(false)
      expect(view.isActive).toBe(false)
    })

    it('projects collapsed mediation flow', () => {
      // Given: collapsed mediation
      const events: GameEvent[] = [
        createMediationStartedEvent('med-1', 'quest-1', ['ironveil', 'ashfall']),
        createMediationCollapsedEvent()
      ]

      // When: projecting
      const view = projectMediationStateFromEvents(events)

      // Then: shows collapsed state
      expect(view.mediationId).toBe('med-1')
      expect(view.hasLeaned).toBe(false)
      expect(view.isCollapsed).toBe(true)
      expect(view.isResolved).toBe(false)
      expect(view.isActive).toBe(false)
    })
  })
})
