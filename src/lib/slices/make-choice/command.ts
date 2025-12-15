// ============================================================================
// MAKE-CHOICE SLICE - Command Handler
// ============================================================================
//
// This slice handles the MAKE_CHOICE command, which is issued when a player
// selects a choice during a narrative dilemma. It validates the command and
// produces the appropriate events based on the choice's consequences.
//
// PRODUCES EVENTS:
// - CHOICE_MADE: The player selected a choice
// - REPUTATION_CHANGED: Faction reputation modified (0-many per choice)
// - CARD_GAINED: Card awarded to player (0-many per choice)
// - CARD_LOST: Card removed from player (0-many per choice)
// - BOUNTY_MODIFIED: Bounty amount changed (0-1 per choice)
// - FLAG_SET: Story flag set (0-many per choice)
// - PHASE_CHANGED: Transition to next phase
// - ALLIANCE_PHASE_STARTED: Alliance options available
// - DILEMMA_PRESENTED: Next dilemma in sequence
//
// BUSINESS RULES:
// - Game must be in progress
// - Must be in narrative phase
// - Must have an active quest
// - Dilemma must exist in content
// - Choice must exist in dilemma's choices
// - Reputation clamped to [-100, 100]
// ============================================================================

import type {
  GameEvent,
  ChoiceMadeEvent,
  ReputationChangedEvent,
  CardGainedEvent,
  CardLostEvent,
  BountyModifiedEvent,
  FlagSetEvent,
  PhaseChangedEvent,
  AlliancePhaseStartedEvent,
  DilemmaPresenedEvent,
  FactionId
} from '../shared-kernel'
import { createTimestamp } from '../shared-kernel'

// Import content helpers
import { getDilemmaById } from '../../game/content/quests'
import { getCardById } from '../../game/content/cards'

// ----------------------------------------------------------------------------
// Command Types
// ----------------------------------------------------------------------------

/**
 * Command to make a choice during a narrative dilemma.
 */
export interface MakeChoiceCommand {
  type: 'MAKE_CHOICE'
  data: {
    dilemmaId: string
    choiceId: string
  }
}

/**
 * Minimal state needed to validate the make choice command.
 */
export interface MakeChoiceState {
  gameStatus: 'not_started' | 'in_progress' | 'ended'
  currentPhase: string
  activeQuest: { questId: string } | null
  reputation: Record<FactionId, number>
  bounty: number
  ownedCards: Array<{ id: string }>
}

// ----------------------------------------------------------------------------
// Error Types
// ----------------------------------------------------------------------------

export class MakeChoiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MakeChoiceError'
  }
}

// ----------------------------------------------------------------------------
// Command Handler
// ----------------------------------------------------------------------------

/**
 * Handle the MAKE_CHOICE command.
 *
 * Validates that:
 * 1. Game is in progress
 * 2. In narrative phase
 * 3. Has active quest
 * 4. Dilemma exists in content
 * 5. Choice exists in dilemma
 *
 * @param command The make choice command
 * @param state Current game state (minimal slice view)
 * @returns Array of events to emit
 * @throws MakeChoiceError if command is invalid
 */
export function handleMakeChoice(
  command: MakeChoiceCommand,
  state: MakeChoiceState
): GameEvent[] {
  // Validate game is in progress
  if (state.gameStatus !== 'in_progress') {
    throw new MakeChoiceError('Game not in progress')
  }

  // Validate in narrative phase
  if (state.currentPhase !== 'narrative') {
    throw new MakeChoiceError('Not in narrative phase')
  }

  // Validate has active quest
  if (!state.activeQuest) {
    throw new MakeChoiceError('No active quest')
  }

  const { dilemmaId, choiceId } = command.data

  // Look up dilemma from content
  const dilemma = getDilemmaById(dilemmaId)
  if (!dilemma) {
    throw new MakeChoiceError(`Dilemma not found: ${dilemmaId}`)
  }

  // Look up choice from dilemma
  const choice = dilemma.choices.find(c => c.id === choiceId)
  if (!choice) {
    throw new MakeChoiceError(`Choice not found: ${choiceId}`)
  }

  const ts = createTimestamp()
  const events: GameEvent[] = []

  // 1. Record the choice
  const choiceMade: ChoiceMadeEvent = {
    type: 'CHOICE_MADE',
    data: {
      timestamp: ts,
      dilemmaId,
      choiceId,
      questId: state.activeQuest.questId
    }
  }
  events.push(choiceMade)

  const consequences = choice.consequences

  // Validate card loss won't drop below minimum (only if choice causes loss)
  const MIN_BATTLE_CARDS = 5
  const cardsToLose = consequences.cardsLost.filter(cardId =>
    state.ownedCards.some(c => c.id === cardId)
  ).length

  if (cardsToLose > 0) {
    const cardsToGain = consequences.cardsGained.length
    const netCardChange = cardsToGain - cardsToLose
    const projectedCardCount = state.ownedCards.length + netCardChange

    if (projectedCardCount < MIN_BATTLE_CARDS) {
      throw new MakeChoiceError(
        `This choice would leave you with ${projectedCardCount} cards, ` +
        `but you need at least ${MIN_BATTLE_CARDS} for battle. Choose differently.`
      )
    }
  }

  // 2. Apply reputation changes
  for (const repChange of consequences.reputationChanges) {
    const currentRep = state.reputation[repChange.faction]
    const newRep = Math.max(-100, Math.min(100, currentRep + repChange.delta))
    const repChanged: ReputationChangedEvent = {
      type: 'REPUTATION_CHANGED',
      data: {
        timestamp: ts,
        factionId: repChange.faction,
        delta: repChange.delta,
        newValue: newRep,
        source: 'choice'
      }
    }
    events.push(repChanged)
  }

  // 3. Apply cards gained
  for (const cardId of consequences.cardsGained) {
    const card = getCardById(cardId)
    if (card) {
      const cardGained: CardGainedEvent = {
        type: 'CARD_GAINED',
        data: {
          timestamp: ts,
          cardId,
          factionId: card.faction,
          source: 'choice'
        }
      }
      events.push(cardGained)
    }
  }

  // 4. Apply cards lost
  for (const cardId of consequences.cardsLost) {
    const card = getCardById(cardId)
    if (card) {
      const cardLost: CardLostEvent = {
        type: 'CARD_LOST',
        data: {
          timestamp: ts,
          cardId,
          factionId: card.faction,
          reason: 'choice'
        }
      }
      events.push(cardLost)
    }
  }

  // 5. Apply bounty modifier
  if (consequences.bountyModifier && consequences.bountyModifier !== 0) {
    const newBounty = Math.max(0, state.bounty + consequences.bountyModifier)
    const bountyModified: BountyModifiedEvent = {
      type: 'BOUNTY_MODIFIED',
      data: {
        timestamp: ts,
        amount: consequences.bountyModifier,
        newValue: newBounty,
        source: 'choice',
        reason: `Choice: ${choice.label}`
      }
    }
    events.push(bountyModified)
  }

  // 6. Set flags
  if (consequences.flags) {
    for (const [flagName, flagValue] of Object.entries(consequences.flags)) {
      const flagSet: FlagSetEvent = {
        type: 'FLAG_SET',
        data: {
          timestamp: ts,
          flagName,
          value: flagValue
        }
      }
      events.push(flagSet)
    }
  }

  // 7. Handle phase transitions based on triggers
  if (consequences.triggersBattle || consequences.triggersAlliance) {
    // Both battle and alliance triggers go to alliance phase first
    const phaseChanged: PhaseChangedEvent = {
      type: 'PHASE_CHANGED',
      data: {
        timestamp: ts,
        fromPhase: 'narrative',
        toPhase: 'alliance'
      }
    }
    events.push(phaseChanged)

    // Emit ALLIANCE_PHASE_STARTED so alliance screen knows context
    const allianceStarted: AlliancePhaseStartedEvent = {
      type: 'ALLIANCE_PHASE_STARTED',
      data: {
        timestamp: ts,
        questId: state.activeQuest.questId,
        battleContext: consequences.triggersBattle
          ? 'Battle ahead - choose your allies wisely'
          : 'Form an alliance to strengthen your position',
        availableFactionIds: ['ironveil', 'ashfall', 'meridian', 'void_wardens', 'sundered_oath'] as FactionId[]
      }
    }
    events.push(allianceStarted)
  } else if (consequences.triggersMediation) {
    const phaseChanged: PhaseChangedEvent = {
      type: 'PHASE_CHANGED',
      data: {
        timestamp: ts,
        fromPhase: 'narrative',
        toPhase: 'mediation'
      }
    }
    events.push(phaseChanged)
  } else if (consequences.nextDilemmaId) {
    // Present the next dilemma (stay in narrative phase)
    const dilemmaPresented: DilemmaPresenedEvent = {
      type: 'DILEMMA_PRESENTED',
      data: {
        timestamp: ts,
        dilemmaId: consequences.nextDilemmaId,
        questId: state.activeQuest.questId
      }
    }
    events.push(dilemmaPresented)
  } else {
    // No explicit next step - default to alliance phase
    const phaseChanged: PhaseChangedEvent = {
      type: 'PHASE_CHANGED',
      data: {
        timestamp: ts,
        fromPhase: 'narrative',
        toPhase: 'alliance'
      }
    }
    events.push(phaseChanged)
  }

  return events
}

// ----------------------------------------------------------------------------
// Command Factory
// ----------------------------------------------------------------------------

/**
 * Create a MAKE_CHOICE command.
 */
export function createMakeChoiceCommand(dilemmaId: string, choiceId: string): MakeChoiceCommand {
  return {
    type: 'MAKE_CHOICE',
    data: { dilemmaId, choiceId }
  }
}
