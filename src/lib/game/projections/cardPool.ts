// ============================================================================
// SPACE FORTRESS - Card Pool View Projection
// ============================================================================
//
// Projects the card selection screen data including:
// - All owned cards with selection state
// - Enemy fleet preview (partial intel)
// - Selection count and commit availability
//
// Used by: Card Pool screen, Fleet Overview screen
// ============================================================================

import type { GameEvent } from '../events'
import type {
  FactionId,
  OwnedCard,
  CardBattleHistory
} from '../types'
import { rebuildState } from '../projections'

// ----------------------------------------------------------------------------
// View Types
// ----------------------------------------------------------------------------

export interface CardViewData {
  id: string
  name: string
  factionId: FactionId
  factionIcon: string
  factionColor: string
  attack: number
  armor: number
  agility: number
  flavorText?: string
  source: 'starter' | 'quest' | 'alliance' | 'choice' | 'unlock'
  isSelected: boolean
  isLocked: boolean
  lockReason?: string
  battleHistory?: CardBattleHistoryView
}

export interface CardBattleHistoryView {
  timesUsed: number
  wins: number
  losses: number
  draws: number
  winRate: string  // e.g., "75%"
}

export interface EnemyFleetPreview {
  name: string
  factionId: FactionId | 'scavengers' | 'pirates'
  factionIcon: string
  shipCount: number
  profile: string  // e.g., "Balanced", "Aggressive", "Defensive"
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface CardPoolView {
  // All cards grouped by faction
  cardsByFaction: Map<FactionId, CardViewData[]>

  // Flat list of all cards
  allCards: CardViewData[]

  // Currently selected cards
  selectedCards: CardViewData[]

  // Selection state
  selectedCount: number
  maxSelection: number
  canCommit: boolean

  // Enemy fleet preview (only during battle context)
  enemyFleet: EnemyFleetPreview | null

  // Current battle context
  battleId: string | null
  isBattleContext: boolean

  // Summary stats
  totalCards: number
  cardCountByFaction: Record<FactionId, number>
  lockedCardCount: number
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const FACTION_ICONS: Record<FactionId | 'scavengers' | 'pirates', string> = {
  ironveil: '▣',
  ashfall: '◈',
  meridian: '⬡',
  void_wardens: '⛊',
  sundered_oath: '✕',
  scavengers: '☠',
  pirates: '⚔'
}

const FACTION_COLORS: Record<FactionId | 'scavengers' | 'pirates', string> = {
  ironveil: '#c9a227',
  ashfall: '#e85d04',
  meridian: '#00b4d8',
  void_wardens: '#7209b7',
  sundered_oath: '#6c757d',
  scavengers: '#8b0000',
  pirates: '#ff4500'
}

const MAX_FLEET_SIZE = 5

// ----------------------------------------------------------------------------
// Projection Function
// ----------------------------------------------------------------------------

export function projectCardPoolView(events: GameEvent[], battleId?: string): CardPoolView {
  const state = rebuildState(events)

  // Determine if we're in battle context
  const isBattleContext = !!state.currentBattle || !!battleId
  const activeBattleId = state.currentBattle?.battleId || battleId || null
  const selectedCardIds = state.currentBattle?.selectedCardIds || []

  // Build card view data
  const allCards: CardViewData[] = state.ownedCards.map(card => {
    const history = state.cardHistory.find(h => h.cardId === card.id)

    return {
      id: card.id,
      name: card.name,
      factionId: card.faction,
      factionIcon: FACTION_ICONS[card.faction],
      factionColor: FACTION_COLORS[card.faction],
      attack: card.attack,
      armor: card.armor,
      agility: card.agility,
      flavorText: card.flavorText,
      source: card.source,
      isSelected: selectedCardIds.includes(card.id),
      isLocked: card.isLocked,
      lockReason: card.lockReason,
      battleHistory: history ? {
        timesUsed: history.timesUsed,
        wins: history.wins,
        losses: history.losses,
        draws: history.draws,
        winRate: history.timesUsed > 0
          ? `${Math.round((history.wins / history.timesUsed) * 100)}%`
          : 'N/A'
      } : undefined
    }
  })

  // Group cards by faction
  const cardsByFaction = new Map<FactionId, CardViewData[]>()
  const factionOrder: FactionId[] = ['ironveil', 'ashfall', 'meridian', 'void_wardens', 'sundered_oath']

  for (const factionId of factionOrder) {
    cardsByFaction.set(factionId, allCards.filter(c => c.factionId === factionId))
  }

  // Get selected cards
  const selectedCards = allCards.filter(c => c.isSelected)

  // Calculate card counts by faction
  const cardCountByFaction: Record<FactionId, number> = {
    ironveil: 0,
    ashfall: 0,
    meridian: 0,
    void_wardens: 0,
    sundered_oath: 0
  }
  for (const card of allCards) {
    cardCountByFaction[card.factionId]++
  }

  // Build enemy fleet preview if in battle context
  let enemyFleet: EnemyFleetPreview | null = null
  if (isBattleContext && state.currentBattle) {
    // Get battle trigger event to determine enemy info
    const battleEvent = events.find(
      e => e.type === 'BATTLE_TRIGGERED' && e.data.battleId === activeBattleId
    )

    if (battleEvent && battleEvent.type === 'BATTLE_TRIGGERED') {
      const factionId = battleEvent.data.opponentFactionId
      enemyFleet = {
        name: `${capitalizeFirst(battleEvent.data.opponentType)} Fleet`,
        factionId,
        factionIcon: FACTION_ICONS[factionId] || '☠',
        shipCount: 5,
        profile: getProfileFromDifficulty(battleEvent.data.difficulty),
        difficulty: battleEvent.data.difficulty
      }
    }
  }

  const lockedCardCount = allCards.filter(c => c.isLocked).length

  return {
    cardsByFaction,
    allCards,
    selectedCards,
    selectedCount: selectedCards.length,
    maxSelection: MAX_FLEET_SIZE,
    canCommit: selectedCards.length === MAX_FLEET_SIZE,
    enemyFleet,
    battleId: activeBattleId,
    isBattleContext,
    totalCards: allCards.length,
    cardCountByFaction,
    lockedCardCount
  }
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function getProfileFromDifficulty(difficulty: 'easy' | 'medium' | 'hard'): string {
  switch (difficulty) {
    case 'easy':
      return 'Uncoordinated'
    case 'medium':
      return 'Balanced'
    case 'hard':
      return 'Elite'
  }
}
