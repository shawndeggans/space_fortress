// ============================================================================
// QUEST-SUMMARY SLICE - Read Model
// ============================================================================
//
// Projects the quest summary view from events, showing:
// - Overall quest outcome
// - All reputation changes during the quest
// - Cards gained and lost
// - Bounty changes
// - Choices made throughout
// - Battle record
//
// ============================================================================

import type { GameEvent, FactionId } from '../shared-kernel'
import { getFactionById } from '../../game/content/factions'
import { getCardById } from '../../game/content/cards'
import { getQuestById } from '../../game/content/quests'
import { getReputationStatus } from '../../game/types'

// ----------------------------------------------------------------------------
// View Types
// ----------------------------------------------------------------------------

export interface FactionSummaryView {
  factionId: FactionId
  factionName: string
  factionIcon: string
  startValue: number
  endValue: number
  netChange: number
  status: string
}

export interface CardSummaryView {
  cardId: string
  cardName: string
  factionId: FactionId
  factionName: string
}

export interface ChoiceSummaryView {
  dilemmaId: string
  choiceId: string
  choiceLabel: string
}

export interface QuestSummaryView {
  // Quest info
  questId: string
  questTitle: string
  questFaction: FactionId
  questFactionName: string
  questFactionIcon: string
  outcome: 'completed' | 'failed' | 'abandoned'

  // Bounty summary
  startingBounty: number
  endingBounty: number
  netBounty: number

  // Reputation changes
  reputationSummary: FactionSummaryView[]

  // Cards
  cardsGained: CardSummaryView[]
  cardsLost: CardSummaryView[]
  netCardChange: number

  // Choices made
  choicesSummary: ChoiceSummaryView[]

  // Battle record
  battlesWon: number
  battlesLost: number
  battlesDraw: number

  // What's next
  remainingQuests: number

  // Ready to display
  isReady: boolean
}

// ----------------------------------------------------------------------------
// Initial View
// ----------------------------------------------------------------------------

export function getInitialQuestSummaryView(): QuestSummaryView {
  return {
    questId: '',
    questTitle: '',
    questFaction: 'ironveil',
    questFactionName: '',
    questFactionIcon: '',
    outcome: 'completed',
    startingBounty: 0,
    endingBounty: 0,
    netBounty: 0,
    reputationSummary: [],
    cardsGained: [],
    cardsLost: [],
    netCardChange: 0,
    choicesSummary: [],
    battlesWon: 0,
    battlesLost: 0,
    battlesDraw: 0,
    remainingQuests: 0,
    isReady: false
  }
}

// ----------------------------------------------------------------------------
// Projection
// ----------------------------------------------------------------------------

export function projectQuestSummaryView(events: GameEvent[]): QuestSummaryView {
  const view = getInitialQuestSummaryView()

  // Find the most recent QUEST_SUMMARY_PRESENTED event
  let summaryEventIndex = -1
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].type === 'QUEST_SUMMARY_PRESENTED') {
      summaryEventIndex = i
      break
    }
  }

  if (summaryEventIndex === -1) {
    return view
  }

  const summaryEvent = events[summaryEventIndex]
  if (summaryEvent.type !== 'QUEST_SUMMARY_PRESENTED') {
    return view
  }

  // Get quest info
  const quest = getQuestById(summaryEvent.data.questId)
  const faction = quest ? getFactionById(quest.faction) : null

  view.questId = summaryEvent.data.questId
  view.questTitle = summaryEvent.data.questTitle
  view.outcome = summaryEvent.data.outcome
  view.questFaction = quest?.faction || 'ironveil'
  view.questFactionName = faction?.name || ''
  view.questFactionIcon = faction?.icon || '⬡'

  // Find the QUEST_ACCEPTED event for this quest
  let questAcceptedIndex = -1
  for (let i = 0; i < events.length; i++) {
    const event = events[i]
    if (event.type === 'QUEST_ACCEPTED' && event.data.questId === view.questId) {
      questAcceptedIndex = i
      break
    }
  }

  if (questAcceptedIndex === -1) {
    // Quest wasn't accepted through normal flow, mark as ready anyway
    view.isReady = true
    return view
  }

  // Track reputation changes - need starting values
  const reputationStart: Record<FactionId, number> = {
    ironveil: 0,
    ashfall: 0,
    meridian: 0,
    void_wardens: 0,
    sundered_oath: 0
  }

  const reputationEnd: Record<FactionId, number> = { ...reputationStart }

  // Calculate starting reputation (from events before quest accepted)
  for (let i = 0; i < questAcceptedIndex; i++) {
    const event = events[i]
    if (event.type === 'REPUTATION_CHANGED') {
      reputationStart[event.data.factionId] = event.data.newValue
      reputationEnd[event.data.factionId] = event.data.newValue
    }
  }

  // Get starting bounty (from QUEST_ACCEPTED event)
  const acceptedEvent = events[questAcceptedIndex]
  if (acceptedEvent.type === 'QUEST_ACCEPTED') {
    view.startingBounty = acceptedEvent.data.initialBounty
  }

  view.endingBounty = view.startingBounty

  // Process all events during the quest
  for (let i = questAcceptedIndex + 1; i <= summaryEventIndex; i++) {
    const event = events[i]

    switch (event.type) {
      case 'REPUTATION_CHANGED':
        reputationEnd[event.data.factionId] = event.data.newValue
        break

      case 'CARD_GAINED': {
        const card = getCardById(event.data.cardId)
        if (card) {
          const cardFaction = getFactionById(card.faction)
          view.cardsGained.push({
            cardId: card.id,
            cardName: card.name,
            factionId: card.faction,
            factionName: cardFaction?.name || card.faction
          })
        }
        break
      }

      case 'CARD_LOST': {
        const card = getCardById(event.data.cardId)
        if (card) {
          const cardFaction = getFactionById(card.faction)
          view.cardsLost.push({
            cardId: card.id,
            cardName: card.name,
            factionId: card.faction,
            factionName: cardFaction?.name || card.faction
          })
        }
        break
      }

      case 'BOUNTY_MODIFIED':
        view.endingBounty = event.data.newValue
        break

      case 'CHOICE_MADE':
        view.choicesSummary.push({
          dilemmaId: event.data.dilemmaId,
          choiceId: event.data.choiceId,
          choiceLabel: event.data.choiceId // Will be enhanced with actual label lookup
        })
        break

      case 'BATTLE_RESOLVED':
        if (event.data.outcome === 'victory') {
          view.battlesWon++
        } else if (event.data.outcome === 'defeat') {
          view.battlesLost++
        } else {
          view.battlesDraw++
        }
        break
    }
  }

  // Calculate net changes
  view.netBounty = view.endingBounty - view.startingBounty
  view.netCardChange = view.cardsGained.length - view.cardsLost.length

  // Build reputation summary for factions that changed
  const factionIds: FactionId[] = ['ironveil', 'ashfall', 'meridian', 'void_wardens', 'sundered_oath']

  for (const factionId of factionIds) {
    const startVal = reputationStart[factionId]
    const endVal = reputationEnd[factionId]
    const netChange = endVal - startVal

    // Only include factions that changed
    if (netChange !== 0) {
      const faction = getFactionById(factionId)
      view.reputationSummary.push({
        factionId,
        factionName: faction?.name || factionId,
        factionIcon: faction?.icon || '⬡',
        startValue: startVal,
        endValue: endVal,
        netChange,
        status: getReputationStatus(endVal)
      })
    }
  }

  // Sort reputation summary by absolute change (most impactful first)
  view.reputationSummary.sort((a, b) => Math.abs(b.netChange) - Math.abs(a.netChange))

  // Count remaining quests (would need to track completed quests)
  // For now, assume 3 total quests available
  const completedQuestIds = new Set<string>()
  for (const event of events) {
    if (event.type === 'QUEST_COMPLETED') {
      completedQuestIds.add(event.data.questId)
    }
  }
  view.remainingQuests = Math.max(0, 3 - completedQuestIds.size)

  view.isReady = true
  return view
}
