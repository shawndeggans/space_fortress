// ============================================================================
// QUEST-SUMMARY SLICE - Read Model
// ============================================================================
//
// Projects the quest summary view from game state, showing:
// - Overall quest outcome
// - Current reputation standings
// - Current bounty
// - Choices made throughout
// - Battle record
//
// ============================================================================

import type { GameState, FactionId } from '../../game/types'
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

export function projectQuestSummaryView(state: GameState): QuestSummaryView {
  const view = getInitialQuestSummaryView()

  // Check if there's a pending quest summary to display
  const pending = state.pendingQuestSummary
  if (!pending) {
    return view
  }

  // Get quest info from pending summary and content
  const quest = getQuestById(pending.questId)
  const faction = quest ? getFactionById(quest.faction) : null

  view.questId = pending.questId
  view.questTitle = pending.questTitle
  view.outcome = pending.outcome
  view.questFaction = quest?.faction || 'ironveil'
  view.questFactionName = faction?.name || ''
  view.questFactionIcon = faction?.icon || '⬡'

  // Use current bounty as ending bounty
  view.endingBounty = state.bounty
  // We don't have starting bounty from state, so just show net as 0
  // A more complete solution would store this in pendingQuestSummary
  view.startingBounty = state.bounty
  view.netBounty = 0

  // Build reputation summary from current state
  // Show all factions with non-zero reputation
  const factionIds: FactionId[] = ['ironveil', 'ashfall', 'meridian', 'void_wardens', 'sundered_oath']

  for (const factionId of factionIds) {
    const currentValue = state.reputation[factionId]
    // Show factions with non-zero reputation
    if (currentValue !== 0) {
      const factionInfo = getFactionById(factionId)
      view.reputationSummary.push({
        factionId,
        factionName: factionInfo?.name || factionId,
        factionIcon: factionInfo?.icon || '⬡',
        startValue: 0, // We don't have starting values in state
        endValue: currentValue,
        netChange: currentValue, // Show current value as "change"
        status: getReputationStatus(currentValue)
      })
    }
  }

  // Sort reputation summary by absolute value (most significant first)
  view.reputationSummary.sort((a, b) => Math.abs(b.endValue) - Math.abs(a.endValue))

  // Get choices for this quest from choice history
  const questChoices = state.choiceHistory.filter(c => c.questId === pending.questId)
  for (const choice of questChoices) {
    // Try to get the actual choice label from quest content
    let choiceLabel = choice.choiceId
    if (quest) {
      for (const dilemma of quest.dilemmas) {
        if (dilemma.id === choice.dilemmaId) {
          const choiceContent = dilemma.choices.find(c => c.id === choice.choiceId)
          if (choiceContent) {
            choiceLabel = choiceContent.label
          }
          break
        }
      }
    }

    view.choicesSummary.push({
      dilemmaId: choice.dilemmaId,
      choiceId: choice.choiceId,
      choiceLabel
    })
  }

  // Get battle record from active quest (if available)
  if (state.activeQuest) {
    view.battlesWon = state.activeQuest.battlesWon
    view.battlesLost = state.activeQuest.battlesLost
    view.battlesDraw = 0 // Not tracked in activeQuest
  }

  // Count remaining quests
  const completedCount = state.completedQuests.length
  view.remainingQuests = Math.max(0, 3 - completedCount - 1) // -1 because current quest will be completed

  // Mark as ready
  view.isReady = true
  return view
}
