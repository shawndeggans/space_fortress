// ============================================================================
// CARD-SELECTION SLICE - Read Model
// ============================================================================
//
// Projects the card pool view from events for the card selection screen.
//
// Displays:
// - All owned cards with selection state
// - Enemy fleet preview (partial intel)
// - Selection count and commit availability
// - Card battle history statistics
// ============================================================================

import type { GameEvent } from '../../game/events'
import type { FactionId, OwnedCard, CardBattleHistory, GameState } from '../../game/types'
import { rebuildState } from '../../game/projections'
import { MAX_FLEET_SIZE } from './command'

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

const FACTION_ORDER: FactionId[] = ['ironveil', 'ashfall', 'meridian', 'void_wardens', 'sundered_oath']

// ----------------------------------------------------------------------------
// Projection Factory
// ----------------------------------------------------------------------------

interface CardSelectionProjectionState {
  ownedCards: OwnedCard[]
  cardHistory: CardBattleHistory[]
  currentBattle: {
    battleId: string
    selectedCardIds: string[]
  } | null
}

export function createCardSelectionProjection() {
  const initialState: CardSelectionProjectionState = {
    ownedCards: [],
    cardHistory: [],
    currentBattle: null
  }

  function reducer(state: CardSelectionProjectionState, event: GameEvent): CardSelectionProjectionState {
    switch (event.type) {
      case 'CARD_GAINED':
        // Add card to owned cards (simplified - full card data comes from content)
        return {
          ...state,
          ownedCards: [
            ...state.ownedCards,
            {
              id: event.data.cardId,
              name: event.data.cardId, // Would be resolved from card content
              faction: event.data.factionId,
              attack: 0,
              armor: 0,
              agility: 0,
              source: event.data.source as OwnedCard['source'],
              acquiredAt: event.data.timestamp,
              isLocked: false
            }
          ]
        }

      case 'CARD_LOST':
        return {
          ...state,
          ownedCards: state.ownedCards.filter(c => c.id !== event.data.cardId)
        }

      case 'BATTLE_TRIGGERED':
        return {
          ...state,
          currentBattle: {
            battleId: event.data.battleId,
            selectedCardIds: []
          }
        }

      case 'CARD_SELECTED':
        if (!state.currentBattle || state.currentBattle.battleId !== event.data.battleId) {
          return state
        }
        return {
          ...state,
          currentBattle: {
            ...state.currentBattle,
            selectedCardIds: [...state.currentBattle.selectedCardIds, event.data.cardId]
          }
        }

      case 'CARD_DESELECTED':
        if (!state.currentBattle || state.currentBattle.battleId !== event.data.battleId) {
          return state
        }
        return {
          ...state,
          currentBattle: {
            ...state.currentBattle,
            selectedCardIds: state.currentBattle.selectedCardIds.filter(id => id !== event.data.cardId)
          }
        }

      case 'FLEET_COMMITTED':
        // Battle continues but selection is locked
        return state

      case 'BATTLE_RESOLVED':
        // Clear current battle after resolution
        return {
          ...state,
          currentBattle: null
        }

      default:
        return state
    }
  }

  return { initialState, reducer }
}

// ----------------------------------------------------------------------------
// View Builders
// ----------------------------------------------------------------------------

export function buildCardPoolView(
  state: CardSelectionProjectionState,
  events: GameEvent[],
  providedGameState?: GameState
): CardPoolView {
  // If full game state provided, use it for complete card data
  const gameState = providedGameState ?? rebuildState(events)

  const isBattleContext = !!state.currentBattle
  const activeBattleId = state.currentBattle?.battleId || null
  const selectedCardIds = state.currentBattle?.selectedCardIds || []

  // Build card view data from game state (has full card info)
  const allCards: CardViewData[] = gameState.ownedCards.map(card => {
    const history = gameState.cardHistory.find(h => h.cardId === card.id)

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
  for (const factionId of FACTION_ORDER) {
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
  if (isBattleContext && activeBattleId) {
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
// Convenience Projection (Pure Event-Sourced)
// ----------------------------------------------------------------------------

export function projectCardPoolFromEvents(events: GameEvent[]): CardPoolView {
  const { initialState, reducer } = createCardSelectionProjection()
  const state = events.reduce(reducer, initialState)
  return buildCardPoolView(state, events)
}

// ----------------------------------------------------------------------------
// Legacy API Adapter
// ----------------------------------------------------------------------------

/**
 * Legacy adapter for backward compatibility with existing UI.
 * Matches the original projectCardPoolView signature.
 */
export function projectCardPoolView(
  events: GameEvent[],
  battleId?: string,
  providedState?: GameState
): CardPoolView {
  // Use the provided state directly if available
  const state = providedState ?? rebuildState(events)

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
  for (const factionId of FACTION_ORDER) {
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
