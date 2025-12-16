// ============================================================================
// CHOICE-CONSEQUENCE SLICE - Read Model
// ============================================================================
//
// Projects the choice consequence view from events, showing:
// - What choice was made
// - All consequences (reputation, cards, bounty, flags)
// - What's coming next
//
// ============================================================================

import type { GameEvent, FactionId } from '../shared-kernel'
import { getFactionById } from '../../game/content/factions'
import { getCardById } from '../../game/content/cards'
import { getDilemmaById, getQuestById } from '../../game/content/quests'
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

export function projectChoiceConsequenceView(events: GameEvent[]): ChoiceConsequenceView {
  const view = getInitialChoiceConsequenceView()

  // Find the most recent CHOICE_CONSEQUENCE_PRESENTED event
  let consequenceEventIndex = -1
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].type === 'CHOICE_CONSEQUENCE_PRESENTED') {
      consequenceEventIndex = i
      break
    }
  }

  if (consequenceEventIndex === -1) {
    return view
  }

  const consequenceEvent = events[consequenceEventIndex]
  if (consequenceEvent.type !== 'CHOICE_CONSEQUENCE_PRESENTED') {
    return view
  }

  // Get quest info
  const quest = getQuestById(consequenceEvent.data.questId)
  view.questId = consequenceEvent.data.questId
  view.questTitle = quest?.title || consequenceEvent.data.questId
  view.dilemmaId = consequenceEvent.data.dilemmaId
  view.choiceId = consequenceEvent.data.choiceId
  view.choiceLabel = consequenceEvent.data.choiceLabel
  view.narrativeText = consequenceEvent.data.narrativeText
  view.triggersNext = consequenceEvent.data.triggersNext

  // Find the CHOICE_MADE event that preceded this
  let choiceMadeIndex = -1
  for (let i = consequenceEventIndex - 1; i >= 0; i--) {
    if (events[i].type === 'CHOICE_MADE') {
      choiceMadeIndex = i
      break
    }
  }

  // Collect all consequence events between CHOICE_MADE and CHOICE_CONSEQUENCE_PRESENTED
  if (choiceMadeIndex >= 0) {
    for (let i = choiceMadeIndex + 1; i < consequenceEventIndex; i++) {
      const event = events[i]

      switch (event.type) {
        case 'REPUTATION_CHANGED': {
          const faction = getFactionById(event.data.factionId)
          view.reputationChanges.push({
            factionId: event.data.factionId,
            factionName: faction?.name || event.data.factionId,
            factionIcon: faction?.icon || '⬡',
            delta: event.data.delta,
            newValue: event.data.newValue,
            status: getReputationStatus(event.data.newValue),
            isPositive: event.data.delta > 0
          })
          break
        }

        case 'CARD_GAINED': {
          const card = getCardById(event.data.cardId)
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
          break
        }

        case 'CARD_LOST': {
          const card = getCardById(event.data.cardId)
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
          break
        }

        case 'BOUNTY_MODIFIED': {
          view.bountyChange = {
            amount: event.data.amount,
            newTotal: event.data.newValue,
            isPositive: event.data.amount > 0,
            reason: event.data.reason || ''
          }
          break
        }

        case 'FLAG_SET': {
          view.flagsSet.push(event.data.flagName)
          break
        }
      }
    }
  }

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
