// ============================================================================
// CHOICE-CONSEQUENCE SLICE - Read Model
// ============================================================================
//
// Projects the choice consequence view from GameState, showing:
// - What choice was made
// - All consequences (reputation, cards, bounty, flags)
// - What's coming next
//
// ============================================================================

import type { FactionId } from '../shared-kernel'
import type { GameState } from '../../game/types'
import { getFactionById } from '../../game/content/factions'
import { getCardById } from '../../game/content/cards'
import { getQuestById } from '../../game/content/quests'
import { getReputationStatus } from '../../game/types'

// ----------------------------------------------------------------------------
// View Types
// ----------------------------------------------------------------------------

export interface ReputationChangeView {
  factionId: FactionId
  factionName: string
  factionIcon: string
  delta: number
  newValue: number
  status: string
  isPositive: boolean
}

export interface CardChangeView {
  cardId: string
  cardName: string
  factionId: FactionId
  factionName: string
  attack: number
  armor: number
  agility: number
}

export interface BountyChangeView {
  amount: number
  newTotal: number
  isPositive: boolean
  reason: string
}

export interface ChoiceConsequenceView {
  // Context
  questId: string
  questTitle: string
  dilemmaId: string
  choiceId: string
  choiceLabel: string

  // Narrative aftermath text
  narrativeText: string

  // What changed
  reputationChanges: ReputationChangeView[]
  cardsGained: CardChangeView[]
  cardsLost: CardChangeView[]
  bountyChange: BountyChangeView | null
  flagsSet: string[]

  // What's next
  triggersNext: 'dilemma' | 'battle' | 'alliance' | 'mediation' | 'quest_complete'
  nextPhaseHint: string

  // Ready to display
  isReady: boolean
}

// ----------------------------------------------------------------------------
// Initial View
// ----------------------------------------------------------------------------

export function getInitialChoiceConsequenceView(): ChoiceConsequenceView {
  return {
    questId: '',
    questTitle: '',
    dilemmaId: '',
    choiceId: '',
    choiceLabel: '',
    narrativeText: '',
    reputationChanges: [],
    cardsGained: [],
    cardsLost: [],
    bountyChange: null,
    flagsSet: [],
    triggersNext: 'dilemma',
    nextPhaseHint: '',
    isReady: false
  }
}

// ----------------------------------------------------------------------------
// Projection
// ----------------------------------------------------------------------------

/**
 * Project choice consequence view from GameState.
 * Uses the pendingChoiceConsequence field populated by evolveState.
 */
export function projectChoiceConsequenceView(state: GameState): ChoiceConsequenceView {
  const view = getInitialChoiceConsequenceView()

  // Check if there's a pending consequence to display
  const pending = state.pendingChoiceConsequence
  if (!pending) {
    return view
  }

  // Get quest info
  const quest = getQuestById(pending.questId)
  view.questId = pending.questId
  view.questTitle = quest?.title || pending.questId
  view.dilemmaId = pending.dilemmaId
  view.choiceId = pending.choiceId
  view.choiceLabel = pending.choiceLabel
  view.narrativeText = pending.narrativeText
  view.triggersNext = pending.triggersNext

  // Process reputation changes
  for (const repChange of pending.consequences.reputationChanges) {
    const faction = getFactionById(repChange.factionId)
    view.reputationChanges.push({
      factionId: repChange.factionId,
      factionName: faction?.name || repChange.factionId,
      factionIcon: faction?.icon || '⬡',
      delta: repChange.delta,
      newValue: repChange.newValue,
      status: getReputationStatus(repChange.newValue),
      isPositive: repChange.delta > 0
    })
  }

  // Process cards gained
  for (const cardId of pending.consequences.cardsGained) {
    const card = getCardById(cardId)
    if (card) {
      const faction = getFactionById(card.faction)
      view.cardsGained.push({
        cardId: card.id,
        cardName: card.name,
        factionId: card.faction,
        factionName: faction?.name || card.faction,
        attack: card.attack,
        armor: card.armor,
        agility: card.agility
      })
    }
  }

  // Process cards lost
  for (const cardId of pending.consequences.cardsLost) {
    const card = getCardById(cardId)
    if (card) {
      const faction = getFactionById(card.faction)
      view.cardsLost.push({
        cardId: card.id,
        cardName: card.name,
        factionId: card.faction,
        factionName: faction?.name || card.faction,
        attack: card.attack,
        armor: card.armor,
        agility: card.agility
      })
    }
  }

  // Process bounty change
  if (pending.consequences.bountyChange) {
    view.bountyChange = {
      amount: pending.consequences.bountyChange.amount,
      newTotal: pending.consequences.bountyChange.newValue,
      isPositive: pending.consequences.bountyChange.amount > 0,
      reason: 'choice'
    }
  }

  // Process flags
  view.flagsSet = [...pending.consequences.flagsSet]

  // Generate next phase hint based on triggers
  switch (view.triggersNext) {
    case 'battle':
      view.nextPhaseHint = 'A battle awaits. Choose your allies wisely...'
      break
    case 'alliance':
      view.nextPhaseHint = 'An opportunity for alliance presents itself...'
      break
    case 'mediation':
      view.nextPhaseHint = 'A delicate negotiation lies ahead...'
      break
    case 'quest_complete':
      view.nextPhaseHint = 'Your quest nears its conclusion...'
      break
    case 'dilemma':
    default:
      view.nextPhaseHint = 'A new challenge emerges from the void...'
      break
  }

  view.isReady = true
  return view
}
