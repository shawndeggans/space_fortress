// ============================================================================
// SPACE FORTRESS - Reputation View Projection
// ============================================================================
//
// Projects the reputation dashboard data including:
// - All faction standings with bars
// - Trend indicators
// - Available/locked card counts
// - Faction detail views
//
// Used by: Reputation Dashboard screen, Faction Detail modal
// ============================================================================

import type { GameEvent } from '../events'
import type { FactionId, ReputationStatus , GameState } from '../types'
import { rebuildState } from '../projections'
import { getReputationStatus } from '../types'

// ----------------------------------------------------------------------------
// View Types
// ----------------------------------------------------------------------------

export interface FactionStandingView {
  factionId: FactionId
  factionName: string
  factionIcon: string
  factionColor: string
  reputation: number
  status: ReputationStatus
  statusLabel: string
  trend: 'rising' | 'falling' | 'stable'
  trendIcon: string
  barPercentage: number  // 0-100 for UI bar (maps -100 to +100 → 0 to 100)
  availableCards: number
  lockedCards: number
  flavorQuote: string
}

export interface ReputationDashboardView {
  factions: FactionStandingView[]
  totalCards: number
  totalLockedCards: number
  dominantFaction: FactionId | null
  dominantFactionName: string | null
}

export interface FactionDetailViewData {
  factionId: FactionId
  factionName: string
  factionIcon: string
  factionColor: string

  // Reputation
  reputation: number
  status: ReputationStatus
  statusLabel: string
  trend: 'rising' | 'falling' | 'stable'

  // Thresholds
  thresholds: ReputationThresholdView[]

  // History
  reputationHistory: ReputationHistoryEntry[]

  // Cards
  availableCards: CardSummary[]
  lockedCards: CardSummary[]
  lockThreshold: number
  unlockProgress: number  // 0-100

  // Faction info
  description: string
  values: string[]
  cardProfile: string
  conflictsWith: FactionConflict[]
}

export interface ReputationThresholdView {
  threshold: number
  status: ReputationStatus
  label: string
  isCurrent: boolean
  isAbove: boolean
}

export interface ReputationHistoryEntry {
  delta: number
  newValue: number
  source: string
  timestamp: string
}

export interface CardSummary {
  cardId: string
  cardName: string
  attack: number
  armor: number
  agility: number
}

export interface FactionConflict {
  factionId: FactionId
  factionName: string
  factionIcon: string
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

// Placeholder faction descriptions - will come from content
const FACTION_DESCRIPTIONS: Record<FactionId, string> = {
  ironveil: 'A corporate syndicate controlling mining and salvage operations. They value contracts, profit, and order above all else.',
  ashfall: 'Refugee survivors of a destroyed world. They seek safe havens and remember those who helped—or hindered—their flight.',
  meridian: 'Neutral brokers and diplomats who profit from maintaining balance between factions. They facilitate trade and negotiate truces.',
  void_wardens: 'Self-appointed guardians of dangerous space. They patrol quarantine zones and contain threats others ignore.',
  sundered_oath: 'Outcasts and oath-breakers united by necessity. They take the jobs others refuse and fight with nothing to lose.'
}

const FACTION_VALUES: Record<FactionId, string[]> = {
  ironveil: ['Profit', 'Contracts', 'Order'],
  ashfall: ['Survival', 'Community', 'Memory'],
  meridian: ['Balance', 'Negotiation', 'Profit'],
  void_wardens: ['Duty', 'Protection', 'Sacrifice'],
  sundered_oath: ['Freedom', 'Power', 'Vengeance']
}

const FACTION_CARD_PROFILES: Record<FactionId, string> = {
  ironveil: 'Siege specialists - high attack, low agility',
  ashfall: 'Interceptors - high agility, low armor',
  meridian: 'Balanced - moderate stats across the board',
  void_wardens: 'Tanks - high armor, low attack',
  sundered_oath: 'Glass cannons - very high attack, low armor'
}

const FACTION_CONFLICTS: Record<FactionId, FactionId[]> = {
  ironveil: ['ashfall'],
  ashfall: ['ironveil'],
  meridian: [],
  void_wardens: ['sundered_oath'],
  sundered_oath: ['void_wardens', 'meridian']
}

// Flavor quotes based on reputation status
const FLAVOR_QUOTES: Record<FactionId, Record<ReputationStatus, string>> = {
  ironveil: {
    devoted: '"A valued partner. Ironveil rewards loyalty."',
    friendly: '"Reliable. Professional. We can work together."',
    neutral: '"Business is business. Prove yourself."',
    unfriendly: '"We\'ve heard troubling reports about you."',
    hostile: '"Contract terminated. Permanently."'
  },
  ashfall: {
    devoted: '"You are one of us now, honored friend."',
    friendly: '"The Remnants remember your kindness."',
    neutral: '"We\'ve heard things. We\'re watching."',
    unfriendly: '"Your actions speak louder than words."',
    hostile: '"You chose poorly. The Remnants never forget."'
  },
  meridian: {
    devoted: '"A partner of impeccable reputation."',
    friendly: '"A balanced approach. We appreciate nuance."',
    neutral: '"All accounts are open for negotiation."',
    unfriendly: '"Your credit is... limited."',
    hostile: '"Some bridges cannot be rebuilt."'
  },
  void_wardens: {
    devoted: '"The Wardens salute your service."',
    friendly: '"A defender of the innocent. Respected."',
    neutral: '"Your intentions remain unclear."',
    unfriendly: '"You tread dangerous ground."',
    hostile: '"Quarantined. Do not approach."'
  },
  sundered_oath: {
    devoted: '"Brother in arms. Sister in shadow."',
    friendly: '"You understand necessity."',
    neutral: '"Everyone has a price."',
    unfriendly: '"Watch your back."',
    hostile: '"Marked."'
  }
}

// ----------------------------------------------------------------------------
// Projection Functions
// ----------------------------------------------------------------------------

export function projectReputationDashboard(events: GameEvent[], providedState?: GameState): ReputationDashboardView {
  const state = providedState ?? rebuildState(events)

  // Calculate reputation trends from events
  const trends = calculateTrends(events)

  const factionIds: FactionId[] = ['ironveil', 'ashfall', 'meridian', 'void_wardens', 'sundered_oath']

  const factions: FactionStandingView[] = factionIds.map(factionId => {
    const rep = state.reputation[factionId]
    const status = getReputationStatus(rep)
    const trend = trends[factionId]

    // Count cards for this faction
    const factionCards = state.ownedCards.filter(c => c.faction === factionId)
    const availableCards = factionCards.filter(c => !c.isLocked).length
    const lockedCards = factionCards.filter(c => c.isLocked).length

    return {
      factionId,
      factionName: FACTION_NAMES[factionId],
      factionIcon: FACTION_ICONS[factionId],
      factionColor: FACTION_COLORS[factionId],
      reputation: rep,
      status,
      statusLabel: STATUS_LABELS[status],
      trend,
      trendIcon: trend === 'rising' ? '↑' : trend === 'falling' ? '↓' : '→',
      barPercentage: Math.round(((rep + 100) / 200) * 100),  // Map -100..+100 to 0..100
      availableCards,
      lockedCards,
      flavorQuote: FLAVOR_QUOTES[factionId][status]
    }
  })

  // Find dominant faction (highest reputation)
  let dominantFaction: FactionId | null = null
  let maxRep = -Infinity
  for (const faction of factions) {
    if (faction.reputation > maxRep && faction.reputation >= 25) {
      maxRep = faction.reputation
      dominantFaction = faction.factionId
    }
  }

  const totalCards = state.ownedCards.length
  const totalLockedCards = state.ownedCards.filter(c => c.isLocked).length

  return {
    factions,
    totalCards,
    totalLockedCards,
    dominantFaction,
    dominantFactionName: dominantFaction ? FACTION_NAMES[dominantFaction] : null
  }
}

export function projectFactionDetailView(events: GameEvent[], factionId: FactionId, providedState?: GameState): FactionDetailViewData {
  const state = providedState ?? rebuildState(events)
  const trends = calculateTrends(events)

  const rep = state.reputation[factionId]
  const status = getReputationStatus(rep)
  const trend = trends[factionId]

  // Build threshold view
  const thresholds: ReputationThresholdView[] = [
    { threshold: 75, status: 'devoted', label: 'Devoted (75+)', isCurrent: status === 'devoted', isAbove: rep >= 75 },
    { threshold: 25, status: 'friendly', label: 'Friendly (25+)', isCurrent: status === 'friendly', isAbove: rep >= 25 },
    { threshold: -24, status: 'neutral', label: 'Neutral (-24 to 24)', isCurrent: status === 'neutral', isAbove: rep >= -24 },
    { threshold: -74, status: 'unfriendly', label: 'Unfriendly (-25 to -74)', isCurrent: status === 'unfriendly', isAbove: rep >= -74 },
    { threshold: -100, status: 'hostile', label: 'Hostile (-75 or below)', isCurrent: status === 'hostile', isAbove: true }
  ]

  // Get reputation history from events
  const repHistory: ReputationHistoryEntry[] = events
    .filter((e): e is Extract<GameEvent, { type: 'REPUTATION_CHANGED' }> =>
      e.type === 'REPUTATION_CHANGED' && e.data.factionId === factionId
    )
    .map(e => ({
      delta: e.data.delta,
      newValue: e.data.newValue,
      source: e.data.source,
      timestamp: e.data.timestamp
    }))
    .reverse()
    .slice(0, 10)  // Last 10 changes

  // Get cards for this faction
  const factionCards = state.ownedCards.filter(c => c.faction === factionId)
  const availableCards: CardSummary[] = factionCards
    .filter(c => !c.isLocked)
    .map(c => ({
      cardId: c.id,
      cardName: c.name,
      attack: c.attack,
      armor: c.armor,
      agility: c.agility
    }))

  const lockedCards: CardSummary[] = factionCards
    .filter(c => c.isLocked)
    .map(c => ({
      cardId: c.id,
      cardName: c.name,
      attack: c.attack,
      armor: c.armor,
      agility: c.agility
    }))

  // Lock threshold is unfriendly (-25)
  const lockThreshold = -25
  const unlockProgress = rep < lockThreshold
    ? Math.round(((rep + 100) / (lockThreshold + 100)) * 100)
    : 100

  // Build conflicts list
  const conflictsWith: FactionConflict[] = FACTION_CONFLICTS[factionId].map(f => ({
    factionId: f,
    factionName: FACTION_NAMES[f],
    factionIcon: FACTION_ICONS[f]
  }))

  return {
    factionId,
    factionName: FACTION_NAMES[factionId],
    factionIcon: FACTION_ICONS[factionId],
    factionColor: FACTION_COLORS[factionId],
    reputation: rep,
    status,
    statusLabel: STATUS_LABELS[status],
    trend,
    thresholds,
    reputationHistory: repHistory,
    availableCards,
    lockedCards,
    lockThreshold,
    unlockProgress,
    description: FACTION_DESCRIPTIONS[factionId],
    values: FACTION_VALUES[factionId],
    cardProfile: FACTION_CARD_PROFILES[factionId],
    conflictsWith
  }
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function calculateTrends(events: GameEvent[]): Record<FactionId, 'rising' | 'falling' | 'stable'> {
  const trends: Record<FactionId, 'rising' | 'falling' | 'stable'> = {
    ironveil: 'stable',
    ashfall: 'stable',
    meridian: 'stable',
    void_wardens: 'stable',
    sundered_oath: 'stable'
  }

  // Get recent reputation changes (last 5 per faction)
  const repChanges = events.filter(
    (e): e is Extract<GameEvent, { type: 'REPUTATION_CHANGED' }> => e.type === 'REPUTATION_CHANGED'
  )

  const factionIds: FactionId[] = ['ironveil', 'ashfall', 'meridian', 'void_wardens', 'sundered_oath']

  for (const factionId of factionIds) {
    const factionChanges = repChanges
      .filter(e => e.data.factionId === factionId)
      .slice(-5)  // Last 5 changes

    if (factionChanges.length === 0) {
      trends[factionId] = 'stable'
      continue
    }

    const totalDelta = factionChanges.reduce((sum, e) => sum + e.data.delta, 0)

    if (totalDelta > 5) {
      trends[factionId] = 'rising'
    } else if (totalDelta < -5) {
      trends[factionId] = 'falling'
    } else {
      trends[factionId] = 'stable'
    }
  }

  return trends
}
