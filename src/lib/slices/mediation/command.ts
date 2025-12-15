// ============================================================================
// MEDIATION SLICE - Command Handlers
// ============================================================================
//
// Handles diplomatic resolution of faction disputes:
// - LEAN_TOWARD_FACTION: Show preference for one faction
// - REFUSE_TO_LEAN: Reject mediation, triggering battle
// - ACCEPT_COMPROMISE: Accept negotiated settlement
//
// Business Rules:
// - Must be in mediation phase
// - Can only lean once per mediation
// - Refusing triggers battle path (phase → card_selection)
// - Accepting compromise ends quest peacefully (phase → consequence)
// ============================================================================

import type { GameEvent } from '../../game/events'
import type { FactionId, GamePhase } from '../../game/types'

// ----------------------------------------------------------------------------
// Error Class
// ----------------------------------------------------------------------------

export class MediationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MediationError'
  }
}

// ----------------------------------------------------------------------------
// Command Types
// ----------------------------------------------------------------------------

export interface LeanTowardFactionCommand {
  type: 'LEAN_TOWARD_FACTION'
  data: {
    towardFactionId: FactionId
  }
}

export interface RefuseToLeanCommand {
  type: 'REFUSE_TO_LEAN'
  data: Record<string, never>
}

export interface AcceptCompromiseCommand {
  type: 'ACCEPT_COMPROMISE'
  data: Record<string, never>
}

export type MediationCommand =
  | LeanTowardFactionCommand
  | RefuseToLeanCommand
  | AcceptCompromiseCommand

// ----------------------------------------------------------------------------
// State Required by Handlers
// ----------------------------------------------------------------------------

export interface MediationState {
  currentPhase: GamePhase
  currentMediationId: string | null
  mediationParties: [FactionId, FactionId] | null
  hasLeaned: boolean
  leanedToward: FactionId | null
}

// ----------------------------------------------------------------------------
// Helper
// ----------------------------------------------------------------------------

function timestamp(): string {
  return new Date().toISOString()
}

// ----------------------------------------------------------------------------
// Command Factories
// ----------------------------------------------------------------------------

export function createLeanTowardFactionCommand(towardFactionId: FactionId): LeanTowardFactionCommand {
  return { type: 'LEAN_TOWARD_FACTION', data: { towardFactionId } }
}

export function createRefuseToLeanCommand(): RefuseToLeanCommand {
  return { type: 'REFUSE_TO_LEAN', data: {} }
}

export function createAcceptCompromiseCommand(): AcceptCompromiseCommand {
  return { type: 'ACCEPT_COMPROMISE', data: {} }
}

// ----------------------------------------------------------------------------
// LEAN_TOWARD_FACTION Handler
// ----------------------------------------------------------------------------

export function handleLeanTowardFaction(
  command: LeanTowardFactionCommand,
  state: MediationState
): GameEvent[] {
  // Validate phase
  if (state.currentPhase !== 'mediation') {
    throw new MediationError('Not in mediation phase')
  }

  // Validate not already leaned
  if (state.hasLeaned) {
    throw new MediationError('Already leaned toward a faction')
  }

  // Determine the "away" faction from mediation parties
  let awayFactionId: FactionId
  if (state.mediationParties) {
    awayFactionId = state.mediationParties[0] === command.data.towardFactionId
      ? state.mediationParties[1]
      : state.mediationParties[0]
  } else {
    // Fallback for backwards compatibility
    awayFactionId = command.data.towardFactionId === 'ironveil' ? 'ashfall' : 'ironveil'
  }

  const ts = timestamp()

  return [
    {
      type: 'MEDIATION_LEANED',
      data: {
        timestamp: ts,
        towardFactionId: command.data.towardFactionId,
        awayFromFactionId: awayFactionId
      }
    }
  ]
}

// ----------------------------------------------------------------------------
// REFUSE_TO_LEAN Handler
// ----------------------------------------------------------------------------

export function handleRefuseToLean(
  command: RefuseToLeanCommand,
  state: MediationState
): GameEvent[] {
  // Validate phase
  if (state.currentPhase !== 'mediation') {
    throw new MediationError('Not in mediation phase')
  }

  const ts = timestamp()

  return [
    {
      type: 'MEDIATION_COLLAPSED',
      data: {
        timestamp: ts,
        reason: 'Player refused to lean toward either party',
        battleTriggered: true
      }
    },
    {
      type: 'PHASE_CHANGED',
      data: {
        timestamp: ts,
        fromPhase: 'mediation',
        toPhase: 'card_selection'
      }
    }
  ]
}

// ----------------------------------------------------------------------------
// ACCEPT_COMPROMISE Handler
// ----------------------------------------------------------------------------

export function handleAcceptCompromise(
  command: AcceptCompromiseCommand,
  state: MediationState
): GameEvent[] {
  // Validate phase
  if (state.currentPhase !== 'mediation') {
    throw new MediationError('Not in mediation phase')
  }

  // Must have leaned before accepting compromise
  if (!state.hasLeaned) {
    throw new MediationError('Must lean toward a faction before accepting compromise')
  }

  const ts = timestamp()

  return [
    {
      type: 'COMPROMISE_ACCEPTED',
      data: {
        timestamp: ts,
        terms: 'Diplomatic resolution reached',
        bountyModifier: 0.5  // Reduced bounty for diplomatic path
      }
    },
    {
      type: 'PHASE_CHANGED',
      data: {
        timestamp: ts,
        fromPhase: 'mediation',
        toPhase: 'consequence'
      }
    }
  ]
}
