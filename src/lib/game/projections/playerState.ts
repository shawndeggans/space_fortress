// ============================================================================
// SPACE FORTRESS - Player State Projection
// ============================================================================
//
// Projects the header display data including:
// - Active quest progress
// - Current phase
// - Reputation summary for all factions
// - Bounty total
//
// Used by: Header component (all screens except Ending)
// ============================================================================

import type { GameEvent } from '../events'
import type {
  FactionId,
  ReputationStatus,
  GamePhase,
  ActiveQuest
, GameState } from '../types'
import { rebuildState } from '../projections'
import { getReputationStatus } from '../types'

// ----------------------------------------------------------------------------
// View Types
// ----------------------------------------------------------------------------

export interface FactionReputationSummary {
  factionId: FactionId
  value: number
  status: ReputationStatus
  icon: string
  color: string
}

export interface ActiveQuestSummary {
  questId: string
  title: string
  factionId: FactionId
  currentDilemmaIndex: number
  totalDilemmas: number
  factionIcon: string
}

export interface PlayerStateView {
  // Game status
  gameStatus: 'not_started' | 'in_progress' | 'ended'
  currentPhase: GamePhase

  // Active quest summary (null if no active quest)
  activeQuest: ActiveQuestSummary | null

  // All faction reputations
  reputations: FactionReputationSummary[]

  // Economy
  bounty: number

  // Stats summary
  questsCompleted: number
  battlesWon: number
  battlesLost: number
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

// Placeholder quest titles - will be replaced with content lookup
const QUEST_TITLES: Record<string, string> = {
  quest_salvage_claim: 'The Salvage Claim',
  quest_sanctuary_run: 'The Sanctuary Run',
  quest_brokers_gambit: "The Broker's Gambit"
}

// Placeholder dilemma counts per quest
const QUEST_DILEMMA_COUNTS: Record<string, number> = {
  quest_salvage_claim: 4,
  quest_sanctuary_run: 4,
  quest_brokers_gambit: 5
}

// ----------------------------------------------------------------------------
// Projection Function
// ----------------------------------------------------------------------------

export function projectPlayerState(events: GameEvent[], providedState?: GameState): PlayerStateView {
  const state = providedState ?? rebuildState(events)

  // Build faction reputation summaries
  const factionIds: FactionId[] = [
    'ironveil',
    'ashfall',
    'meridian',
    'void_wardens',
    'sundered_oath'
  ]

  const reputations: FactionReputationSummary[] = factionIds.map(factionId => ({
    factionId,
    value: state.reputation[factionId],
    status: getReputationStatus(state.reputation[factionId]),
    icon: FACTION_ICONS[factionId],
    color: FACTION_COLORS[factionId]
  }))

  // Build active quest summary if applicable
  let activeQuest: ActiveQuestSummary | null = null
  if (state.activeQuest) {
    const questId = state.activeQuest.questId

    // Determine faction from quest ID (temporary - will use content lookup)
    let factionId: FactionId = 'ironveil'
    if (questId.includes('sanctuary')) factionId = 'ashfall'
    if (questId.includes('broker')) factionId = 'meridian'

    activeQuest = {
      questId,
      title: QUEST_TITLES[questId] || questId,
      factionId,
      currentDilemmaIndex: state.activeQuest.currentDilemmaIndex,
      totalDilemmas: QUEST_DILEMMA_COUNTS[questId] || 4,
      factionIcon: FACTION_ICONS[factionId]
    }
  }

  return {
    gameStatus: state.gameStatus,
    currentPhase: state.currentPhase,
    activeQuest,
    reputations,
    bounty: state.bounty,
    questsCompleted: state.stats.questsCompleted,
    battlesWon: state.stats.battlesWon,
    battlesLost: state.stats.battlesLost
  }
}
