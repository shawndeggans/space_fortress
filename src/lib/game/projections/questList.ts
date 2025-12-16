// ============================================================================
// SPACE FORTRESS - Quest List Projection
// ============================================================================
//
// Projects the quest hub screen data including:
// - Available quests with unlock status
// - Completed quests with outcomes
// - Quest detail view for modal
//
// Used by: Quest Hub screen, Quest Detail modal
// ============================================================================

import type { GameEvent } from '../events'
import type {
  FactionId,
  ReputationStatus,
  QuestStatus
, GameState } from '../types'
import { rebuildState } from '../projections'
import { getReputationStatus } from '../types'

// ----------------------------------------------------------------------------
// View Types
// ----------------------------------------------------------------------------

export interface QuestListItem {
  questId: string
  title: string
  briefDescription: string
  factionId: FactionId
  factionIcon: string
  factionColor: string
  status: QuestStatus
  bountyLevel: number  // 1-5 indicator
  reputationRequired: number
  currentReputation: number
  unlockMessage?: string  // e.g., "Requires Friendly (+25) rep"
}

export interface CompletedQuestItem {
  questId: string
  title: string
  factionId: FactionId
  factionIcon: string
  outcome: 'completed' | 'full' | 'partial' | 'compromised'
  finalBounty: number
  completedAt: string
}

export interface QuestListView {
  available: QuestListItem[]
  locked: QuestListItem[]
  completed: CompletedQuestItem[]
  hasActiveQuest: boolean
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
  warningText?: string
}

export interface CardPreview {
  name: string
  factionId: FactionId
  profile: string  // e.g., "Siege", "Interceptor"
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const FACTION_ICONS: Record<FactionId, string> = {
  ironveil: '▣',
  ashfall: '◈',
  meridian: '⬡',
  void_wardens: '⛊',
  sundered_oath: '✕'
}

const FACTION_COLORS: Record<FactionId, string> = {
  ironveil: '#c9a227',
  ashfall: '#e85d04',
  meridian: '#00b4d8',
  void_wardens: '#7209b7',
  sundered_oath: '#6c757d'
}

const FACTION_NAMES: Record<FactionId, string> = {
  ironveil: 'Ironveil Syndicate',
  ashfall: 'Ashfall Remnants',
  meridian: 'Meridian Accord',
  void_wardens: 'Void Wardens',
  sundered_oath: 'Sundered Oath'
}

// Placeholder quest data - will be replaced with content module
interface QuestData {
  id: string
  factionId: FactionId
  title: string
  briefDescription: string
  fullDescription: string
  questGiverName: string
  questGiverDialogue: string
  reputationRequired: number
  initialBounty: number
  bountyLevel: number
  warningText?: string
}

const QUEST_DATA: Record<string, QuestData> = {
  quest_salvage_claim: {
    id: 'quest_salvage_claim',
    factionId: 'ironveil',
    title: 'The Salvage Claim',
    briefDescription: 'Secure a derelict colony ship in contested space.',
    fullDescription: 'A derelict colony ship has been detected in contested space. Ironveil claims salvage rights. The Ashfall Remnants claim it contains survivors—their people.',
    questGiverName: 'Castellan Vorn',
    questGiverDialogue: "Secure it, and you'll be compensated fairly.",
    reputationRequired: 0,
    initialBounty: 500,
    bountyLevel: 3,
    warningText: 'This may anger the Ashfall Remnants'
  },
  quest_sanctuary_run: {
    id: 'quest_sanctuary_run',
    factionId: 'ashfall',
    title: 'The Sanctuary Run',
    briefDescription: 'Help the Remnants breach a Void Warden blockade to reach sanctuary.',
    fullDescription: 'Ashfall refugees are trapped behind a Void Warden blockade. They need safe passage to their sanctuary world, but the Wardens claim the sector is quarantined.',
    questGiverName: 'Elder Yara',
    questGiverDialogue: 'Our people have waited long enough. Will you help them find home?',
    reputationRequired: 0,
    initialBounty: 400,
    bountyLevel: 2,
    warningText: 'The Void Wardens may not forgive interference'
  },
  quest_brokers_gambit: {
    id: 'quest_brokers_gambit',
    factionId: 'meridian',
    title: "The Broker's Gambit",
    briefDescription: 'Mediate a volatile trade dispute between rival factions.',
    fullDescription: 'A valuable cargo has been claimed by multiple factions. Meridian needs a neutral party to oversee negotiations—or determine who deserves the prize.',
    questGiverName: 'Broker Desh',
    questGiverDialogue: 'Everyone wants a piece of this deal. I need someone who can keep them talking instead of shooting.',
    reputationRequired: 0,
    initialBounty: 600,
    bountyLevel: 4
  }
}

// ----------------------------------------------------------------------------
// Projection Functions
// ----------------------------------------------------------------------------

export function projectQuestList(events: GameEvent[], providedState?: GameState): QuestListView {
  const state = providedState ?? rebuildState(events)

  const available: QuestListItem[] = []
  const locked: QuestListItem[] = []
  const completed: CompletedQuestItem[] = []

  // Process available quests
  for (const questId of state.availableQuestIds) {
    const questData = QUEST_DATA[questId]
    if (!questData) continue

    const currentRep = state.reputation[questData.factionId]
    const repStatus = getReputationStatus(currentRep)
    const meetsRequirement = currentRep >= questData.reputationRequired

    const questItem: QuestListItem = {
      questId: questData.id,
      title: questData.title,
      briefDescription: questData.briefDescription,
      factionId: questData.factionId,
      factionIcon: FACTION_ICONS[questData.factionId],
      factionColor: FACTION_COLORS[questData.factionId],
      status: meetsRequirement ? 'available' : 'locked',
      bountyLevel: questData.bountyLevel,
      reputationRequired: questData.reputationRequired,
      currentReputation: currentRep
    }

    if (!meetsRequirement) {
      questItem.unlockMessage = `Requires ${getStatusName(questData.reputationRequired)} (${questData.reputationRequired >= 0 ? '+' : ''}${questData.reputationRequired}) rep. Currently: ${getReputationStatus(currentRep)} (${currentRep >= 0 ? '+' : ''}${currentRep})`
      locked.push(questItem)
    } else {
      available.push(questItem)
    }
  }

  // Process completed quests
  for (const quest of state.completedQuests) {
    const questData = QUEST_DATA[quest.questId]
    if (!questData) continue

    completed.push({
      questId: quest.questId,
      title: questData.title,
      factionId: questData.factionId,
      factionIcon: FACTION_ICONS[questData.factionId],
      outcome: quest.outcome,
      finalBounty: quest.finalBounty,
      completedAt: quest.completedAt
    })
  }

  return {
    available,
    locked,
    completed,
    hasActiveQuest: state.activeQuest !== null
  }
}

export function projectQuestDetail(events: GameEvent[], questId: string, providedState?: GameState): QuestDetailView | null {
  const state = providedState ?? rebuildState(events)
  const questData = QUEST_DATA[questId]

  if (!questData) return null

  const currentRep = state.reputation[questData.factionId]
  const repStatus = getReputationStatus(currentRep)
  const canAccept = currentRep >= questData.reputationRequired && state.activeQuest === null

  // Placeholder card previews - will come from content
  const initialCards: CardPreview[] = [
    { name: `${FACTION_NAMES[questData.factionId]} Ship`, factionId: questData.factionId, profile: 'Balanced' }
  ]

  return {
    questId: questData.id,
    title: questData.title,
    fullDescription: questData.fullDescription,
    factionId: questData.factionId,
    factionName: FACTION_NAMES[questData.factionId],
    factionIcon: FACTION_ICONS[questData.factionId],
    factionColor: FACTION_COLORS[questData.factionId],
    questGiverName: questData.questGiverName,
    questGiverDialogue: questData.questGiverDialogue,
    initialBounty: questData.initialBounty,
    initialCards,
    reputationRequired: questData.reputationRequired,
    currentReputation: currentRep,
    reputationStatus: repStatus,
    canAccept,
    warningText: questData.warningText
  }
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function getStatusName(value: number): string {
  if (value >= 75) return 'Devoted'
  if (value >= 25) return 'Friendly'
  if (value >= -24) return 'Neutral'
  if (value >= -74) return 'Unfriendly'
  return 'Hostile'
}
