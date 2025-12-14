// ============================================================================
// SPACE FORTRESS - Consequence View Projection
// ============================================================================
//
// Projects the consequence screen data including:
// - Battle outcome narrative
// - Bounty breakdown
// - Reputation changes
// - Cards gained/lost
//
// Used by: Consequence screen
// ============================================================================

import type { GameEvent } from '../events'
import type {
  FactionId,
  BattleOutcome
, GameState } from '../types'
import { rebuildState, filterEventsByType } from '../projections'

// ----------------------------------------------------------------------------
// View Types
// ----------------------------------------------------------------------------

export interface BountyBreakdownView {
  baseReward: number
  shares: BountyShareView[]
  modifiers: BountyModifierView[]
  netReward: number
}

export interface BountyShareView {
  factionId: FactionId
  factionIcon: string
  factionColor: string
  amount: number
  reason: string
  percentage: number
}

export interface BountyModifierView {
  amount: number
  reason: string
  isPositive: boolean
}

export interface ReputationChangeView {
  factionId: FactionId
  factionName: string
  factionIcon: string
  factionColor: string
  delta: number
  newValue: number
  newStatus: string
  direction: 'up' | 'down' | 'neutral'
}

export interface CardChangeView {
  cardName: string
  factionId: FactionId
  factionIcon: string
  isGained: boolean
  reason: string
}

export interface ConsequenceViewData {
  // Battle info
  battleId: string
  outcome: BattleOutcome
  outcomeLabel: string
  outcomeClass: 'victory' | 'defeat' | 'draw'

  // Narrative text
  narrativeText: string

  // Bounty breakdown
  bounty: BountyBreakdownView

  // Reputation changes
  reputationChanges: ReputationChangeView[]

  // Card changes
  cardsGained: CardChangeView[]
  cardsLost: CardChangeView[]

  // Next action
  hasNextDilemma: boolean
  questComplete: boolean
  continueButtonText: string
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

const STATUS_NAMES: Record<string, string> = {
  devoted: 'Devoted',
  friendly: 'Friendly',
  neutral: 'Neutral',
  unfriendly: 'Unfriendly',
  hostile: 'Hostile'
}

// Placeholder narrative text - will come from content
const OUTCOME_NARRATIVES: Record<BattleOutcome, string[]> = {
  victory: [
    'The enemy fleet scatters as your forces secure the objective.',
    'Victory is yours. The battle has shifted the balance of power.',
    'Your tactical superiority proves decisive in this engagement.'
  ],
  defeat: [
    'Your fleet is forced to retreat. The enemy holds the field.',
    'The battle is lost, but your fleet survives to fight another day.',
    'A bitter defeat. You must regroup and reconsider your approach.'
  ],
  draw: [
    'Neither side gains the upper hand. The engagement ends in stalemate.',
    'Both fleets withdraw, neither able to claim victory.',
    'The battle proves inconclusive. The situation remains unresolved.'
  ]
}

// ----------------------------------------------------------------------------
// Projection Function
// ----------------------------------------------------------------------------

export function projectConsequenceView(events: GameEvent[], battleId?: string, providedState?: GameState): ConsequenceViewData | null {
  const state = providedState ?? rebuildState(events)

  // Get battle info
  const battle = state.currentBattle
  const targetBattleId = battleId || battle?.battleId

  if (!targetBattleId) return null

  // Find battle resolved event
  const battleResolvedEvent = events.find(
    e => e.type === 'BATTLE_RESOLVED' && e.data.battleId === targetBattleId
  )

  let outcome: BattleOutcome = 'draw'
  if (battleResolvedEvent && battleResolvedEvent.type === 'BATTLE_RESOLVED') {
    outcome = battleResolvedEvent.data.outcome
  } else if (battle?.outcome) {
    outcome = battle.outcome
  }

  // Get bounty calculation
  const bountyEvent = events.find(
    e => e.type === 'BOUNTY_CALCULATED' && e.data.battleId === targetBattleId
  )

  let bounty: BountyBreakdownView
  if (bountyEvent && bountyEvent.type === 'BOUNTY_CALCULATED') {
    const shares: BountyShareView[] = bountyEvent.data.shares.map(s => ({
      factionId: s.factionId,
      factionIcon: FACTION_ICONS[s.factionId],
      factionColor: FACTION_COLORS[s.factionId],
      amount: s.amount,
      reason: s.reason,
      percentage: bountyEvent.data.base > 0
        ? Math.round((s.amount / bountyEvent.data.base) * 100)
        : 0
    }))

    const modifiers: BountyModifierView[] = bountyEvent.data.modifiers.map(m => ({
      amount: m.amount,
      reason: m.reason,
      isPositive: m.amount > 0
    }))

    bounty = {
      baseReward: bountyEvent.data.base,
      shares,
      modifiers,
      netReward: bountyEvent.data.net
    }
  } else {
    // Default bounty structure
    bounty = {
      baseReward: state.activeQuest ? 500 : 0,
      shares: [],
      modifiers: [],
      netReward: state.activeQuest ? 500 : 0
    }
  }

  // Get reputation changes from events after battle
  const battleTimestamp = battleResolvedEvent?.data.timestamp || ''
  const repChanges = events.filter(
    e => e.type === 'REPUTATION_CHANGED' && e.data.timestamp >= battleTimestamp
  )

  const reputationChanges: ReputationChangeView[] = repChanges
    .filter((e): e is Extract<GameEvent, { type: 'REPUTATION_CHANGED' }> => e.type === 'REPUTATION_CHANGED')
    .map(e => ({
      factionId: e.data.factionId,
      factionName: FACTION_NAMES[e.data.factionId],
      factionIcon: FACTION_ICONS[e.data.factionId],
      factionColor: FACTION_COLORS[e.data.factionId],
      delta: e.data.delta,
      newValue: e.data.newValue,
      newStatus: getStatusName(e.data.newValue),
      direction: e.data.delta > 0 ? 'up' : e.data.delta < 0 ? 'down' : 'neutral'
    }))

  // Get card changes from events after battle
  const cardGainedEvents = events.filter(
    e => e.type === 'CARD_GAINED' && e.data.timestamp >= battleTimestamp
  )
  const cardLostEvents = events.filter(
    e => e.type === 'CARD_LOST' && e.data.timestamp >= battleTimestamp
  )

  const cardsGained: CardChangeView[] = cardGainedEvents
    .filter((e): e is Extract<GameEvent, { type: 'CARD_GAINED' }> => e.type === 'CARD_GAINED')
    .map(e => ({
      cardName: e.data.cardId.replace(/_/g, ' '),
      factionId: e.data.factionId,
      factionIcon: FACTION_ICONS[e.data.factionId],
      isGained: true,
      reason: e.data.source
    }))

  const cardsLost: CardChangeView[] = cardLostEvents
    .filter((e): e is Extract<GameEvent, { type: 'CARD_LOST' }> => e.type === 'CARD_LOST')
    .map(e => ({
      cardName: e.data.cardId.replace(/_/g, ' '),
      factionId: e.data.factionId,
      factionIcon: FACTION_ICONS[e.data.factionId],
      isGained: false,
      reason: e.data.reason
    }))

  // Determine next action
  const hasActiveQuest = state.activeQuest !== null
  const questComplete = !hasActiveQuest || state.stats.questsCompleted > state.completedQuests.length

  let continueButtonText = 'Continue'
  if (questComplete) {
    continueButtonText = 'Complete Quest'
  } else {
    continueButtonText = 'A new dilemma awaits...'
  }

  // Select narrative text
  const narratives = OUTCOME_NARRATIVES[outcome]
  const narrativeText = narratives[Math.floor(Math.random() * narratives.length)]

  return {
    battleId: targetBattleId,
    outcome,
    outcomeLabel: outcome === 'victory' ? 'VICTORY' : outcome === 'defeat' ? 'DEFEAT' : 'DRAW',
    outcomeClass: outcome,
    narrativeText,
    bounty,
    reputationChanges,
    cardsGained,
    cardsLost,
    hasNextDilemma: hasActiveQuest && !questComplete,
    questComplete,
    continueButtonText
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
