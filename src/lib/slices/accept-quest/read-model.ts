// ============================================================================
// ACCEPT-QUEST SLICE - Read Model
// ============================================================================
//
// This module provides the read model (projection) for the quest hub screen.
// It projects data needed for displaying and accepting quests.
//
// CONSUMES EVENTS:
// - GAME_STARTED: Initialize reputation and owned cards
// - QUEST_ACCEPTED: Mark quest as active, remove from available
// - QUEST_COMPLETED: Move quest to completed list
// - QUEST_FAILED: Move quest to failed list
// - REPUTATION_CHANGED: Update faction reputation (affects quest unlock)
// - CARD_GAINED: Track owned cards for quest card previews
//
// VIEW TYPES:
// - QuestListView: List of available/locked/completed quests
// - QuestDetailView: Full details for quest acceptance screen
// ============================================================================

import type {
  FactionId,
  ReputationStatus,
  GameEvent
} from '../shared-kernel'
import { getReputationStatus, createProjection } from '../shared-kernel'

// Import quest content for metadata
import { getQuestById, allQuests } from '../../game/content/quests'
import { getCardById } from '../../game/content/cards'
import { factions } from '../../game/content/factions'

// ----------------------------------------------------------------------------
// View Types
// ----------------------------------------------------------------------------

export type QuestStatus = 'available' | 'locked' | 'active' | 'completed' | 'failed'

export interface QuestListItem {
  questId: string
  title: string
  briefDescription: string
  factionId: FactionId
  factionName: string
  factionIcon: string
  factionColor: string
  status: QuestStatus
  bountyLevel: number  // 1-5 indicator based on initial bounty
  reputationRequired: number
  currentReputation: number
  isUnlocked: boolean
  unlockMessage?: string
}

export interface CompletedQuestItem {
  questId: string
  title: string
  factionId: FactionId
  factionIcon: string
  outcome: 'full' | 'partial' | 'compromised' | 'failed'
  finalBounty: number
  completedAt: string
}

export interface CardPreview {
  cardId: string
  name: string
  factionId: FactionId
  attack: number
  armor: number
  agility: number
}

export interface QuestListView {
  available: QuestListItem[]
  locked: QuestListItem[]
  completed: CompletedQuestItem[]
  hasActiveQuest: boolean
  activeQuestId: string | null
}

export interface QuestDetailView {
  questId: string
  title: string
  fullDescription: string
  factionId: FactionId
  factionName: string
  factionIcon: string
  factionColor: string
  questGiverName: string
  questGiverDialogue: string
  initialBounty: number
  initialCards: CardPreview[]
  reputationRequired: number
  currentReputation: number
  reputationStatus: ReputationStatus
  canAccept: boolean
  cantAcceptReason?: string
  warningText?: string
}

// ----------------------------------------------------------------------------
// Internal State
// ----------------------------------------------------------------------------

interface QuestSliceState {
  reputation: Record<FactionId, number>
  availableQuestIds: string[]
  activeQuestId: string | null
  completedQuests: Array<{
    questId: string
    outcome: 'full' | 'partial' | 'compromised'
    finalBounty: number
    completedAt: string
  }>
  failedQuests: Array<{
    questId: string
    failedAt: string
  }>
}

// ----------------------------------------------------------------------------
// State Reducer
// ----------------------------------------------------------------------------

function getInitialState(): QuestSliceState {
  return {
    reputation: {
      ironveil: 0,
      ashfall: 0,
      meridian: 0,
      void_wardens: 0,
      sundered_oath: 0
    },
    availableQuestIds: allQuests.map(q => q.id),
    activeQuestId: null,
    completedQuests: [],
    failedQuests: []
  }
}

function reducer(state: QuestSliceState, event: GameEvent): QuestSliceState {
  switch (event.type) {
    case 'GAME_STARTED':
      return getInitialState()

    case 'QUEST_ACCEPTED':
      return {
        ...state,
        activeQuestId: event.data.questId,
        availableQuestIds: state.availableQuestIds.filter(
          id => id !== event.data.questId
        )
      }

    case 'QUEST_COMPLETED':
      return {
        ...state,
        activeQuestId: null,
        completedQuests: [
          ...state.completedQuests,
          {
            questId: event.data.questId,
            outcome: event.data.outcome,
            finalBounty: event.data.finalBounty,
            completedAt: event.data.timestamp
          }
        ]
      }

    case 'QUEST_FAILED':
      return {
        ...state,
        activeQuestId: null,
        failedQuests: [
          ...state.failedQuests,
          {
            questId: event.data.questId,
            failedAt: event.data.timestamp
          }
        ]
      }

    case 'REPUTATION_CHANGED':
      return {
        ...state,
        reputation: {
          ...state.reputation,
          [event.data.factionId]: event.data.newValue
        }
      }

    default:
      return state
  }
}

// ----------------------------------------------------------------------------
// Projection Factory
// ----------------------------------------------------------------------------

/**
 * Create a quest list projection that builds state from events.
 */
export function createQuestListProjection() {
  return createProjection(getInitialState(), reducer)
}

// ----------------------------------------------------------------------------
// View Builders
// ----------------------------------------------------------------------------

/**
 * Build the quest list view from current state.
 */
export function buildQuestListView(state: QuestSliceState): QuestListView {
  const available: QuestListItem[] = []
  const locked: QuestListItem[] = []
  const completed: CompletedQuestItem[] = []

  // Process available quests
  for (const questId of state.availableQuestIds) {
    const quest = getQuestById(questId)
    if (!quest) continue

    const faction = factions[quest.faction]
    const currentRep = state.reputation[quest.faction]
    const isUnlocked = currentRep >= quest.reputationRequired

    const questItem: QuestListItem = {
      questId: quest.id,
      title: quest.title,
      briefDescription: quest.briefDescription,
      factionId: quest.faction,
      factionName: faction?.name ?? quest.faction,
      factionIcon: faction?.icon ?? '?',
      factionColor: faction?.color ?? '#888888',
      status: isUnlocked ? 'available' : 'locked',
      bountyLevel: getBountyLevel(quest.initialBounty),
      reputationRequired: quest.reputationRequired,
      currentReputation: currentRep,
      isUnlocked
    }

    if (!isUnlocked) {
      questItem.unlockMessage = buildUnlockMessage(quest.reputationRequired, currentRep)
      locked.push(questItem)
    } else {
      available.push(questItem)
    }
  }

  // Process completed quests
  for (const completedQuest of state.completedQuests) {
    const quest = getQuestById(completedQuest.questId)
    if (!quest) continue

    const faction = factions[quest.faction]

    completed.push({
      questId: completedQuest.questId,
      title: quest.title,
      factionId: quest.faction,
      factionIcon: faction?.icon ?? '?',
      outcome: completedQuest.outcome,
      finalBounty: completedQuest.finalBounty,
      completedAt: completedQuest.completedAt
    })
  }

  // Add failed quests to completed list
  for (const failedQuest of state.failedQuests) {
    const quest = getQuestById(failedQuest.questId)
    if (!quest) continue

    const faction = factions[quest.faction]

    completed.push({
      questId: failedQuest.questId,
      title: quest.title,
      factionId: quest.faction,
      factionIcon: faction?.icon ?? '?',
      outcome: 'failed',
      finalBounty: 0,
      completedAt: failedQuest.failedAt
    })
  }

  return {
    available,
    locked,
    completed,
    hasActiveQuest: state.activeQuestId !== null,
    activeQuestId: state.activeQuestId
  }
}

/**
 * Build the quest detail view for a specific quest.
 */
export function buildQuestDetailView(
  state: QuestSliceState,
  questId: string
): QuestDetailView | null {
  const quest = getQuestById(questId)
  if (!quest) return null

  const faction = factions[quest.faction]
  const currentRep = state.reputation[quest.faction]
  const repStatus = getReputationStatus(currentRep)
  const meetsRepRequirement = currentRep >= quest.reputationRequired
  const hasNoActiveQuest = state.activeQuestId === null
  const canAccept = meetsRepRequirement && hasNoActiveQuest

  // Build card previews
  const initialCards: CardPreview[] = quest.initialCards
    .map(cardId => {
      const card = getCardById(cardId)
      if (!card) return null
      return {
        cardId: card.id,
        name: card.name,
        factionId: card.faction,
        attack: card.attack,
        armor: card.armor,
        agility: card.agility
      }
    })
    .filter((card): card is CardPreview => card !== null)

  let cantAcceptReason: string | undefined
  if (!meetsRepRequirement) {
    cantAcceptReason = buildUnlockMessage(quest.reputationRequired, currentRep)
  } else if (!hasNoActiveQuest) {
    cantAcceptReason = 'You already have an active quest'
  }

  return {
    questId: quest.id,
    title: quest.title,
    fullDescription: quest.fullDescription,
    factionId: quest.faction,
    factionName: faction?.name ?? quest.faction,
    factionIcon: faction?.icon ?? '?',
    factionColor: faction?.color ?? '#888888',
    questGiverName: quest.questGiverName,
    questGiverDialogue: quest.questGiverDialogue,
    initialBounty: quest.initialBounty,
    initialCards,
    reputationRequired: quest.reputationRequired,
    currentReputation: currentRep,
    reputationStatus: repStatus,
    canAccept,
    cantAcceptReason,
    warningText: quest.warningText
  }
}

// ----------------------------------------------------------------------------
// Convenience Functions
// ----------------------------------------------------------------------------

/**
 * Project quest list view directly from events.
 * Use this for one-off projections; use createQuestListProjection()
 * for subscribed/reactive projections.
 */
export function projectQuestListFromEvents(events: GameEvent[]): QuestListView {
  const state = events.reduce(reducer, getInitialState())
  return buildQuestListView(state)
}

/**
 * Project quest detail view directly from events.
 */
export function projectQuestDetailFromEvents(
  events: GameEvent[],
  questId: string
): QuestDetailView | null {
  const state = events.reduce(reducer, getInitialState())
  return buildQuestDetailView(state, questId)
}

// ----------------------------------------------------------------------------
// Legacy API Adapters (for backward compatibility with existing UI)
// ----------------------------------------------------------------------------

/**
 * Full game state interface (imported from game module for compatibility).
 * This allows the slice to work with the existing game store.
 */
interface LegacyGameState {
  reputation: Record<FactionId, number>
  availableQuestIds: string[]
  activeQuest: { questId: string } | null
  completedQuests: Array<{
    questId: string
    outcome: 'full' | 'partial' | 'compromised'
    finalBounty: number
    completedAt: string
  }>
}

/**
 * Convert legacy GameState to slice internal state.
 */
function fromLegacyState(legacyState: LegacyGameState): QuestSliceState {
  return {
    reputation: legacyState.reputation,
    availableQuestIds: legacyState.availableQuestIds,
    activeQuestId: legacyState.activeQuest?.questId ?? null,
    completedQuests: legacyState.completedQuests,
    failedQuests: []
  }
}

/**
 * Project quest list view from events OR provided state.
 * This maintains backward compatibility with the existing UI API:
 *   projectQuestList([], $gameState)
 *
 * @param events - Events to replay (ignored if providedState is given)
 * @param providedState - Full game state from store (optional)
 */
export function projectQuestList(
  events: GameEvent[],
  providedState?: LegacyGameState
): QuestListView {
  if (providedState) {
    // Use provided state directly (existing UI pattern)
    const sliceState = fromLegacyState(providedState)
    return buildQuestListView(sliceState)
  }
  // Fall back to building from events
  return projectQuestListFromEvents(events)
}

/**
 * Project quest detail view from events OR provided state.
 * This maintains backward compatibility with the existing UI API:
 *   projectQuestDetail([], questId, $gameState)
 *
 * @param events - Events to replay (ignored if providedState is given)
 * @param questId - The quest to get details for
 * @param providedState - Full game state from store (optional)
 */
export function projectQuestDetail(
  events: GameEvent[],
  questId: string,
  providedState?: LegacyGameState
): QuestDetailView | null {
  if (providedState) {
    // Use provided state directly (existing UI pattern)
    const sliceState = fromLegacyState(providedState)
    return buildQuestDetailView(sliceState, questId)
  }
  // Fall back to building from events
  return projectQuestDetailFromEvents(events, questId)
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function getBountyLevel(bounty: number): number {
  if (bounty >= 800) return 5
  if (bounty >= 600) return 4
  if (bounty >= 400) return 3
  if (bounty >= 200) return 2
  return 1
}

function buildUnlockMessage(required: number, current: number): string {
  const requiredStatus = getStatusName(required)
  const currentStatus = getStatusName(current)
  const requiredSign = required >= 0 ? '+' : ''
  const currentSign = current >= 0 ? '+' : ''

  return `Requires ${requiredStatus} (${requiredSign}${required}) reputation. Currently: ${currentStatus} (${currentSign}${current})`
}

function getStatusName(value: number): string {
  if (value >= 75) return 'Devoted'
  if (value >= 25) return 'Friendly'
  if (value >= -24) return 'Neutral'
  if (value >= -74) return 'Unfriendly'
  return 'Hostile'
}
