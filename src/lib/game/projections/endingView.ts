// ============================================================================
// SPACE FORTRESS - Ending View Projection
// ============================================================================
//
// Projects the ending screen data including:
// - Ending type and narrative
// - Final faction standings
// - Statistics and records
// - Fleet composition summary
//
// Used by: Ending screen
// ============================================================================

import type { GameEvent } from '../events'
import type {
  FactionId,
  ReputationStatus,
  EndingType
} from '../types'
import { rebuildState } from '../projections'
import { getReputationStatus } from '../types'

// ----------------------------------------------------------------------------
// View Types
// ----------------------------------------------------------------------------

export interface FinalStandingView {
  factionId: FactionId
  factionName: string
  factionIcon: string
  factionColor: string
  reputation: number
  status: ReputationStatus
  statusLabel: string
  barPercentage: number
}

export interface StatisticView {
  label: string
  value: string | number
  icon?: string
}

export interface EndingViewData {
  // Ending type
  endingType: EndingType
  title: string
  subtitle: string

  // Narrative
  summaryText: string

  // Final standings
  standings: FinalStandingView[]
  primaryFaction: FactionId | null
  primaryFactionName: string | null

  // Fleet composition
  fleetComposition: FleetCompositionView

  // Statistics
  statistics: StatisticView[]

  // Play time
  playTimeFormatted: string

  // Actions
  showChoiceHistoryLink: boolean
  showNewGameButton: boolean
}

export interface FleetCompositionView {
  totalCards: number
  byFaction: Array<{
    factionId: FactionId
    factionIcon: string
    factionColor: string
    count: number
    percentage: number
  }>
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

const STATUS_LABELS: Record<ReputationStatus, string> = {
  devoted: 'Devoted',
  friendly: 'Friendly',
  neutral: 'Neutral',
  unfriendly: 'Unfriendly',
  hostile: 'Hostile'
}

// Ending type data
interface EndingData {
  title: string
  subtitle: string
  summary: string
}

const ENDINGS: Record<EndingType, EndingData> = {
  faction_commander: {
    title: 'THE FACTION COMMANDER',
    subtitle: '"One banner. One cause."',
    summary: 'Your unwavering loyalty to a single faction has made you their most trusted captain. When they call, you answer. Their enemies are your enemies. In the cutthroat politics of the sector, you\'ve chosen a side—and proven yourself indispensable.'
  },
  broker: {
    title: 'THE BROKER',
    subtitle: '"Everyone owes me a favor."',
    summary: 'You\'ve maintained careful balance among the factions, cultivating relationships without commitment. No faction fully trusts you, but none can afford to lose you. In a sector of extremists, your neutrality is your greatest asset.'
  },
  opportunist: {
    title: 'THE OPPORTUNIST',
    subtitle: '"Information is currency."',
    summary: 'Secret deals, hidden alliances, strategic betrayals—you\'ve played all sides against each other and profited from the chaos. Some call it treachery. You call it survival. In the end, only the outcome matters.'
  },
  conqueror: {
    title: 'THE CONQUEROR',
    subtitle: '"Let the cannons speak."',
    summary: 'When words failed, your fleet succeeded. Battle after battle, your tactical prowess has made you a legend. Factions may distrust you, but they fear your guns more. In the sector, strength commands respect.'
  },
  negotiator: {
    title: 'THE NEGOTIATOR',
    subtitle: '"Battles end. Agreements endure."',
    summary: 'In a sector defined by conflict, you chose dialogue. The Ashfall colonists remember your mediation. The Void Wardens respect your even hand. Your reputation carries weight that weapons cannot purchase.'
  }
}

// ----------------------------------------------------------------------------
// Projection Function
// ----------------------------------------------------------------------------

export function projectEndingView(events: GameEvent[]): EndingViewData | null {
  const state = rebuildState(events)

  // Check if game has ended
  if (state.gameStatus !== 'ended') return null

  // Get ending determination event
  const endingEvent = events.find(e => e.type === 'ENDING_DETERMINED')
  let endingType: EndingType = determineEnding(state)
  let title = ENDINGS[endingType].title
  let subtitle = ENDINGS[endingType].subtitle

  if (endingEvent && endingEvent.type === 'ENDING_DETERMINED') {
    endingType = endingEvent.data.endingType
    title = endingEvent.data.title || ENDINGS[endingType].title
    subtitle = endingEvent.data.subtitle || ENDINGS[endingType].subtitle
  }

  // Build final standings
  const factionIds: FactionId[] = ['ironveil', 'ashfall', 'meridian', 'void_wardens', 'sundered_oath']

  const standings: FinalStandingView[] = factionIds.map(factionId => {
    const rep = state.reputation[factionId]
    const status = getReputationStatus(rep)

    return {
      factionId,
      factionName: FACTION_NAMES[factionId],
      factionIcon: FACTION_ICONS[factionId],
      factionColor: FACTION_COLORS[factionId],
      reputation: rep,
      status,
      statusLabel: STATUS_LABELS[status],
      barPercentage: Math.round(((rep + 100) / 200) * 100)
    }
  }).sort((a, b) => b.reputation - a.reputation)

  // Find primary faction (highest positive reputation)
  let primaryFaction: FactionId | null = null
  let primaryFactionName: string | null = null
  if (standings[0].reputation >= 25) {
    primaryFaction = standings[0].factionId
    primaryFactionName = standings[0].factionName
  }

  // Build fleet composition
  const fleetByFaction: Record<FactionId, number> = {
    ironveil: 0,
    ashfall: 0,
    meridian: 0,
    void_wardens: 0,
    sundered_oath: 0
  }
  for (const card of state.ownedCards) {
    fleetByFaction[card.faction]++
  }

  const totalCards = state.ownedCards.length
  const fleetComposition: FleetCompositionView = {
    totalCards,
    byFaction: factionIds
      .map(factionId => ({
        factionId,
        factionIcon: FACTION_ICONS[factionId],
        factionColor: FACTION_COLORS[factionId],
        count: fleetByFaction[factionId],
        percentage: totalCards > 0 ? Math.round((fleetByFaction[factionId] / totalCards) * 100) : 0
      }))
      .filter(f => f.count > 0)
      .sort((a, b) => b.count - a.count)
  }

  // Build statistics
  const statistics: StatisticView[] = [
    { label: 'Quests Completed', value: state.stats.questsCompleted, icon: '📜' },
    { label: 'Battles Won', value: state.stats.battlesWon, icon: '⚔' },
    { label: 'Battles Lost', value: state.stats.battlesLost, icon: '💀' },
    { label: 'Battles Avoided', value: state.stats.battlesAvoided, icon: '🕊' },
    { label: 'Alliances Formed', value: state.stats.alliancesFormed, icon: '🤝' },
    { label: 'Secret Alliances', value: state.stats.secretAlliancesFormed, icon: '🗝' },
    { label: 'Betrayals', value: state.stats.betrayals, icon: '🗡' },
    { label: 'Total Bounty Earned', value: `${state.stats.totalBountyEarned} cr`, icon: '💰' },
    { label: 'Cards Acquired', value: state.stats.cardsAcquired, icon: '🃏' }
  ]

  // Format play time
  const playTimeFormatted = formatPlayTime(state.stats.playTimeSeconds)

  return {
    endingType,
    title,
    subtitle,
    summaryText: ENDINGS[endingType].summary,
    standings,
    primaryFaction,
    primaryFactionName,
    fleetComposition,
    statistics,
    playTimeFormatted,
    showChoiceHistoryLink: true,
    showNewGameButton: true
  }
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function determineEnding(state: ReturnType<typeof rebuildState>): EndingType {
  const { stats, reputation } = state

  // Check for faction commander (high single faction rep)
  const factionIds: FactionId[] = ['ironveil', 'ashfall', 'meridian', 'void_wardens', 'sundered_oath']
  const maxRep = Math.max(...factionIds.map(f => reputation[f]))
  if (maxRep >= 75) {
    return 'faction_commander'
  }

  // Check for conqueror (high battle wins)
  if (stats.battlesWon >= 5 && stats.battlesWon > stats.battlesAvoided * 2) {
    return 'conqueror'
  }

  // Check for negotiator (high diplomatic resolutions)
  if (stats.battlesAvoided >= 2 && stats.battlesAvoided >= stats.battlesWon) {
    return 'negotiator'
  }

  // Check for opportunist (secret alliances and betrayals)
  if (stats.secretAlliancesFormed >= 2 || stats.betrayals >= 1) {
    return 'opportunist'
  }

  // Check for broker (balanced reputation)
  const friendlyCount = factionIds.filter(f => reputation[f] >= 25).length
  if (friendlyCount >= 3) {
    return 'broker'
  }

  // Default to broker
  return 'broker'
}

function formatPlayTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} seconds`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes < 60) {
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes} minutes`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}m`
    : `${hours} hours`
}
