// ============================================================================
// FORM-ALLIANCE SLICE - Command Handler
// ============================================================================
//
// This slice handles alliance-related commands:
// - FORM_ALLIANCE: Form alliance with a faction
// - FINALIZE_ALLIANCES: Proceed to battle (with alliances)
// - DECLINE_ALL_ALLIANCES: Proceed to battle (alone)
// - REJECT_ALLIANCE_TERMS: Decline specific faction's offer
//
// PRODUCES EVENTS:
// - ALLIANCE_FORMED: Alliance established with faction
// - CARD_GAINED: 2 cards per alliance
// - ALLIANCE_REJECTED: Player declined specific faction
// - ALLIANCES_DECLINED: Player proceeds without allies
// - BATTLE_TRIGGERED: Battle is imminent
// - PHASE_CHANGED: Transition to card_selection
//
// BUSINESS RULES:
// - Must be in alliance phase
// - Must have active quest
// - Cannot ally with hostile faction (rep <= -75)
// - Need 5+ cards to proceed to battle
// - Bounty share based on reputation status
// ============================================================================

import type {
  GameEvent,
  AllianceFormedEvent,
  CardGainedEvent,
  AllianceRejectedEvent,
  AlliancesDeclinedEvent,
  BattleTriggeredEvent,
  PhaseChangedEvent,
  FactionId
} from '../shared-kernel'
import { createTimestamp, getReputationStatus } from '../shared-kernel'

// Import content helpers
import { getAllianceCardIds } from '../../game/content/cards'

// ----------------------------------------------------------------------------
// Command Types
// ----------------------------------------------------------------------------

export interface FormAllianceCommand {
  type: 'FORM_ALLIANCE'
  data: {
    factionId: FactionId
  }
}

export interface FinalizeAlliancesCommand {
  type: 'FINALIZE_ALLIANCES'
  data: Record<string, never>
}

export interface DeclineAllAlliancesCommand {
  type: 'DECLINE_ALL_ALLIANCES'
  data: Record<string, never>
}

export interface RejectAllianceTermsCommand {
  type: 'REJECT_ALLIANCE_TERMS'
  data: {
    factionId: FactionId
  }
}

export type AllianceCommand =
  | FormAllianceCommand
  | FinalizeAlliancesCommand
  | DeclineAllAlliancesCommand
  | RejectAllianceTermsCommand

/**
 * Minimal state needed to validate alliance commands.
 */
export interface AllianceState {
  gameStatus: 'not_started' | 'in_progress' | 'ended'
  currentPhase: string
  activeQuest: { questId: string } | null
  reputation: Record<FactionId, number>
  ownedCardCount: number
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const MIN_BATTLE_CARDS = 5

// ----------------------------------------------------------------------------
// Error Types
// ----------------------------------------------------------------------------

export class AllianceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AllianceError'
  }
}

// ----------------------------------------------------------------------------
// ID Generator
// ----------------------------------------------------------------------------

function generateBattleId(): string {
  return `battle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// ----------------------------------------------------------------------------
// Command Handlers
// ----------------------------------------------------------------------------

/**
 * Handle the FORM_ALLIANCE command.
 */
export function handleFormAlliance(
  command: FormAllianceCommand,
  state: AllianceState
): GameEvent[] {
  if (state.currentPhase !== 'alliance') {
    throw new AllianceError('Not in alliance phase')
  }

  if (!state.activeQuest) {
    throw new AllianceError('No active quest')
  }

  const { factionId } = command.data
  const factionRep = state.reputation[factionId] ?? 0
  const status = getReputationStatus(factionRep)

  if (status === 'hostile') {
    throw new AllianceError('Faction is hostile and will not ally with you')
  }

  const ts = createTimestamp()

  // Calculate bounty share based on reputation
  let bountyShare = 0.30 // Default 30%
  if (status === 'friendly') bountyShare = 0.25
  if (status === 'devoted') bountyShare = 0.15

  // Get alliance cards for this faction (2 cards per alliance)
  const allianceCardIds = getAllianceCardIds(factionId)

  const events: GameEvent[] = []

  // Alliance formed event
  const allianceFormed: AllianceFormedEvent = {
    type: 'ALLIANCE_FORMED',
    data: {
      timestamp: ts,
      factionId,
      bountyShare,
      cardIdsProvided: allianceCardIds,
      isSecret: false
    }
  }
  events.push(allianceFormed)

  // Card gained events for each alliance card
  for (const cardId of allianceCardIds) {
    const cardGained: CardGainedEvent = {
      type: 'CARD_GAINED',
      data: {
        timestamp: ts,
        cardId,
        factionId,
        source: 'alliance'
      }
    }
    events.push(cardGained)
  }

  // Stay in alliance phase - player can form more alliances
  return events
}

/**
 * Handle the FINALIZE_ALLIANCES command.
 */
export function handleFinalizeAlliances(
  command: FinalizeAlliancesCommand,
  state: AllianceState
): GameEvent[] {
  if (state.currentPhase !== 'alliance') {
    throw new AllianceError('Not in alliance phase')
  }

  if (!state.activeQuest) {
    throw new AllianceError('No active quest')
  }

  // Validate minimum card requirement
  if (state.ownedCardCount < MIN_BATTLE_CARDS) {
    throw new AllianceError(
      `Need ${MIN_BATTLE_CARDS} cards for battle but only have ${state.ownedCardCount}. Form more alliances to continue.`
    )
  }

  const ts = createTimestamp()
  const battleId = generateBattleId()

  const battleTriggered: BattleTriggeredEvent = {
    type: 'BATTLE_TRIGGERED',
    data: {
      timestamp: ts,
      battleId,
      questId: state.activeQuest.questId,
      context: 'Alliances finalized - prepare for battle',
      opponentType: 'enemy_forces',
      opponentFactionId: 'scavengers',
      difficulty: 'medium'
    }
  }

  const phaseChanged: PhaseChangedEvent = {
    type: 'PHASE_CHANGED',
    data: {
      timestamp: ts,
      fromPhase: 'alliance',
      toPhase: 'card_selection'
    }
  }

  return [battleTriggered, phaseChanged]
}

/**
 * Handle the DECLINE_ALL_ALLIANCES command.
 */
export function handleDeclineAllAlliances(
  command: DeclineAllAlliancesCommand,
  state: AllianceState
): GameEvent[] {
  if (!state.activeQuest) {
    throw new AllianceError('No active quest')
  }

  // Validate minimum card requirement
  if (state.ownedCardCount < MIN_BATTLE_CARDS) {
    throw new AllianceError(
      `Cannot proceed without allies. You have ${state.ownedCardCount} cards ` +
      `but battle requires ${MIN_BATTLE_CARDS}. Form an alliance to continue.`
    )
  }

  const ts = createTimestamp()
  const battleId = generateBattleId()

  const alliancesDeclined: AlliancesDeclinedEvent = {
    type: 'ALLIANCES_DECLINED',
    data: {
      timestamp: ts,
      questId: state.activeQuest.questId
    }
  }

  const battleTriggered: BattleTriggeredEvent = {
    type: 'BATTLE_TRIGGERED',
    data: {
      timestamp: ts,
      battleId,
      questId: state.activeQuest.questId,
      context: 'Going it alone - prepare for battle',
      opponentType: 'enemy_forces',
      opponentFactionId: 'scavengers',
      difficulty: 'medium'
    }
  }

  const phaseChanged: PhaseChangedEvent = {
    type: 'PHASE_CHANGED',
    data: {
      timestamp: ts,
      fromPhase: 'alliance',
      toPhase: 'card_selection'
    }
  }

  return [alliancesDeclined, battleTriggered, phaseChanged]
}

/**
 * Handle the REJECT_ALLIANCE_TERMS command.
 */
export function handleRejectAllianceTerms(
  command: RejectAllianceTermsCommand,
  state: AllianceState
): GameEvent[] {
  const allianceRejected: AllianceRejectedEvent = {
    type: 'ALLIANCE_REJECTED',
    data: {
      timestamp: createTimestamp(),
      factionId: command.data.factionId
    }
  }

  return [allianceRejected]
}

// ----------------------------------------------------------------------------
// Command Factories
// ----------------------------------------------------------------------------

export function createFormAllianceCommand(factionId: FactionId): FormAllianceCommand {
  return {
    type: 'FORM_ALLIANCE',
    data: { factionId }
  }
}

export function createFinalizeAlliancesCommand(): FinalizeAlliancesCommand {
  return {
    type: 'FINALIZE_ALLIANCES',
    data: {}
  }
}

export function createDeclineAllAlliancesCommand(): DeclineAllAlliancesCommand {
  return {
    type: 'DECLINE_ALL_ALLIANCES',
    data: {}
  }
}

export function createRejectAllianceTermsCommand(factionId: FactionId): RejectAllianceTermsCommand {
  return {
    type: 'REJECT_ALLIANCE_TERMS',
    data: { factionId }
  }
}
