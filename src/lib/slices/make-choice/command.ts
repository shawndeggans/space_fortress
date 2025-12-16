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
// - CHOICE_CONSEQUENCE_PRESENTED: Shows consequence screen
// - PHASE_CHANGED: Transition to choice_consequence phase
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
  ChoiceConsequencePresentedEvent,
  ChoiceConsequenceData,
  FactionId
} from '../shared-kernel'
import { createTimestamp } from '../shared-kernel'

// Import content helpers
import { getDilemmaById, getQuestById } from '../../game/content/quests'
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

  // Track consequence data for display
  const consequenceData: ChoiceConsequenceData = {
    reputationChanges: [],
    cardsGained: [],
    cardsLost: [],
    bountyChange: null,
    flagsSet: []
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

    // Track for consequence display
    consequenceData.reputationChanges.push({
      factionId: repChange.faction,
      delta: repChange.delta,
      newValue: newRep
    })
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

      // Track for consequence display
      consequenceData.cardsGained.push(cardId)
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

      // Track for consequence display
      consequenceData.cardsLost.push(cardId)
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

    // Track for consequence display
    consequenceData.bountyChange = {
      amount: consequences.bountyModifier,
      newValue: newBounty
    }
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

      // Track for consequence display (only true flags)
      if (flagValue) {
        consequenceData.flagsSet.push(flagName)
      }
    }
  }

  // 7. Determine what triggers next (for choice consequence screen)
  let triggersNext: 'dilemma' | 'battle' | 'alliance' | 'mediation' | 'quest_complete' = 'dilemma'

  if (consequences.triggersBattle) {
    triggersNext = 'battle'
  } else if (consequences.triggersAlliance) {
    triggersNext = 'alliance'
  } else if (consequences.triggersMediation) {
    triggersNext = 'mediation'
  } else if (consequences.nextDilemmaId) {
    triggersNext = 'dilemma'
  } else {
    // Check if this is the final dilemma
    const quest = getQuestById(state.activeQuest.questId)
    const isLastDilemma = quest
      ? quest.dilemmaIds.indexOf(dilemmaId) === quest.dilemmaIds.length - 1
      : true

    if (isLastDilemma) {
      triggersNext = 'quest_complete'
    } else {
      // Default to dilemma (or alliance if no next dilemma specified)
      triggersNext = consequences.nextDilemmaId ? 'dilemma' : 'alliance'
    }
  }

  // 8. Generate narrative aftermath text
  const narrativeText = generateNarrativeText(choice.label, consequences, triggersNext)

  // 9. Emit CHOICE_CONSEQUENCE_PRESENTED event
  const consequencePresented: ChoiceConsequencePresentedEvent = {
    type: 'CHOICE_CONSEQUENCE_PRESENTED',
    data: {
      timestamp: ts,
      dilemmaId,
      choiceId,
      questId: state.activeQuest.questId,
      choiceLabel: choice.label,
      narrativeText,
      triggersNext,
      consequences: consequenceData
    }
  }
  events.push(consequencePresented)

  // 10. Transition to choice_consequence phase
  const phaseChanged: PhaseChangedEvent = {
    type: 'PHASE_CHANGED',
    data: {
      timestamp: ts,
      fromPhase: 'narrative',
      toPhase: 'choice_consequence'
    }
  }
  events.push(phaseChanged)

  return events
}

// ----------------------------------------------------------------------------
// Narrative Text Generator
// ----------------------------------------------------------------------------

/**
 * Generate aftermath text based on choice and consequences.
 * Provides cinematic flavor text for the consequence screen.
 */
function generateNarrativeText(
  choiceLabel: string,
  consequences: { reputationChanges: Array<{ faction: string; delta: number }>; bountyModifier?: number },
  triggersNext: string
): string {
  const templates: Record<string, string[]> = {
    positive_rep: [
      'Your decision strengthens old bonds and forges new alliances.',
      'Word of your actions spreads quickly through the sector.',
      'Your reputation precedes you now.',
    ],
    negative_rep: [
      'Some doors close as others open.',
      'Your choice will not be forgotten.',
      'The consequences of your decision ripple through the void.',
    ],
    bounty_gain: [
      'Your coffers grow heavier with credits.',
      'A profitable outcome, though profit is not everything.',
    ],
    bounty_loss: [
      'Credits flow from your account, but some things are worth more than money.',
      'The cost is steep, but you made your choice.',
    ],
    battle_ahead: [
      'Steel yourself. Conflict awaits beyond the next jump.',
      'The path ahead leads through fire and fury.',
    ],
    mediation_ahead: [
      'A delicate negotiation lies ahead. Choose your words carefully.',
      'Diplomacy may yet prevail, if you can find common ground.',
    ],
    quest_complete: [
      'Your quest nears its conclusion. The sector will remember this.',
      'The final threads of this tale are weaving together.',
    ],
    default: [
      'Your choice echoes through the void...',
      'The consequences of your decision unfold.',
      'What comes next remains to be seen.',
    ]
  }

  // Determine which template category to use
  let category = 'default'

  if (triggersNext === 'battle') {
    category = 'battle_ahead'
  } else if (triggersNext === 'mediation') {
    category = 'mediation_ahead'
  } else if (triggersNext === 'quest_complete') {
    category = 'quest_complete'
  } else if (consequences.reputationChanges.length > 0) {
    const netRep = consequences.reputationChanges.reduce((sum, r) => sum + r.delta, 0)
    category = netRep >= 0 ? 'positive_rep' : 'negative_rep'
  } else if (consequences.bountyModifier) {
    category = consequences.bountyModifier > 0 ? 'bounty_gain' : 'bounty_loss'
  }

  const options = templates[category]
  return options[Math.floor(Math.random() * options.length)]
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
