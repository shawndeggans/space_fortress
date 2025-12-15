// ============================================================================
// DEPLOYMENT SLICE - Read Model
// ============================================================================
//
// Projects the deployment view from events for the deployment screen.
//
// Displays:
// - 5 numbered slots with assigned cards
// - Unassigned cards from committed fleet
// - Lock orders availability
// - Tactics tips based on fleet composition
// ============================================================================

import type { GameEvent } from '../../game/events'
import type { FactionId, OwnedCard, GameState } from '../../game/types'
import { rebuildState } from '../../game/projections'
import { TOTAL_POSITIONS } from './command'

// ----------------------------------------------------------------------------
// View Types
// ----------------------------------------------------------------------------

export interface DeploymentCardView {
  id: string
  name: string
  factionId: FactionId
  factionIcon: string
  factionColor: string
  attack: number
  armor: number
  agility: number
}

export interface DeploymentSlot {
  position: number  // 1-5
  card: DeploymentCardView | null
  isEmpty: boolean
}

export interface DeploymentView {
  // The 5 deployment slots
  slots: DeploymentSlot[]

  // Cards not yet assigned to slots
  unassignedCards: DeploymentCardView[]

  // Deployment state
  assignedCount: number
  totalSlots: number
  canLockOrders: boolean

  // Battle context
  battleId: string
  battleContext: string

  // Tip text based on situation
  tacticsTip: string
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

// Tactics tips based on fleet composition
const TACTICS_TIPS = [
  'High agility cards strike first. Consider leading with tanks to absorb enemy alpha strikes.',
  'Position high-armor cards against predicted enemy glass cannons.',
  'Save your highest attack cards for positions where you expect enemy tanks.',
  'A balanced fleet can adapt to any opponent. Consider spreading your stats.',
  'If you have interceptors, position them early to take advantage of first strike.'
]

// ----------------------------------------------------------------------------
// Projection State
// ----------------------------------------------------------------------------

interface DeploymentProjectionState {
  ownedCards: OwnedCard[]
  currentBattle: {
    battleId: string
    context: string
    selectedCardIds: string[]
    positions: (string | null)[]
  } | null
}

// ----------------------------------------------------------------------------
// Projection Factory
// ----------------------------------------------------------------------------

export function createDeploymentProjection() {
  const initialState: DeploymentProjectionState = {
    ownedCards: [],
    currentBattle: null
  }

  function reducer(state: DeploymentProjectionState, event: GameEvent): DeploymentProjectionState {
    switch (event.type) {
      case 'CARD_GAINED':
        return {
          ...state,
          ownedCards: [
            ...state.ownedCards,
            {
              id: event.data.cardId,
              name: event.data.cardId,
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
            context: event.data.context,
            selectedCardIds: [],
            positions: [null, null, null, null, null]
          }
        }

      case 'FLEET_COMMITTED':
        if (!state.currentBattle || state.currentBattle.battleId !== event.data.battleId) {
          return state
        }
        return {
          ...state,
          currentBattle: {
            ...state.currentBattle,
            selectedCardIds: event.data.cardIds,
            positions: [null, null, null, null, null]
          }
        }

      case 'CARD_POSITIONED':
        if (!state.currentBattle || state.currentBattle.battleId !== event.data.battleId) {
          return state
        }
        // Clear card from any previous position
        const newPositions = state.currentBattle.positions.map(
          p => p === event.data.cardId ? null : p
        )
        // Set card in new position (0-indexed)
        newPositions[event.data.position - 1] = event.data.cardId
        return {
          ...state,
          currentBattle: {
            ...state.currentBattle,
            positions: newPositions
          }
        }

      case 'ORDERS_LOCKED':
        // Positions are now locked
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

export function buildDeploymentView(
  state: DeploymentProjectionState,
  events: GameEvent[],
  providedGameState?: GameState
): DeploymentView | null {
  if (!state.currentBattle) {
    return null
  }

  // Use provided game state for complete card data if available
  const gameState = providedGameState ?? rebuildState(events)

  const battle = state.currentBattle
  const positions = battle.positions
  const selectedCardIds = battle.selectedCardIds

  // Build card lookup from owned cards
  const cardLookup = new Map<string, DeploymentCardView>()
  for (const card of gameState.ownedCards) {
    if (selectedCardIds.includes(card.id)) {
      cardLookup.set(card.id, {
        id: card.id,
        name: card.name,
        factionId: card.faction,
        factionIcon: FACTION_ICONS[card.faction],
        factionColor: FACTION_COLORS[card.faction],
        attack: card.attack,
        armor: card.armor,
        agility: card.agility
      })
    }
  }

  // Build slots
  const slots: DeploymentSlot[] = []
  const assignedCardIds = new Set<string>()

  for (let i = 0; i < TOTAL_POSITIONS; i++) {
    const cardId = positions[i]
    const card = cardId ? cardLookup.get(cardId) || null : null

    if (cardId && card) {
      assignedCardIds.add(cardId)
    }

    slots.push({
      position: i + 1,  // 1-indexed for display
      card,
      isEmpty: card === null
    })
  }

  // Find unassigned cards
  const unassignedCards: DeploymentCardView[] = []
  for (const cardId of selectedCardIds) {
    if (!assignedCardIds.has(cardId)) {
      const card = cardLookup.get(cardId)
      if (card) {
        unassignedCards.push(card)
      }
    }
  }

  // Determine tactics tip based on fleet composition
  const tacticsTip = selectTacticsTip(Array.from(cardLookup.values()))

  // Calculate assigned count from filled positions (not from unassignedCards)
  const assignedCount = positions.filter(p => p !== null).length

  return {
    slots,
    unassignedCards,
    assignedCount,
    totalSlots: TOTAL_POSITIONS,
    canLockOrders: assignedCount === TOTAL_POSITIONS,
    battleId: battle.battleId,
    battleContext: battle.context,
    tacticsTip
  }
}

// ----------------------------------------------------------------------------
// Convenience Projection (Pure Event-Sourced)
// ----------------------------------------------------------------------------

export function projectDeploymentFromEvents(events: GameEvent[]): DeploymentView | null {
  const { initialState, reducer } = createDeploymentProjection()
  const state = events.reduce(reducer, initialState)
  return buildDeploymentView(state, events)
}

// ----------------------------------------------------------------------------
// Legacy API Adapter
// ----------------------------------------------------------------------------

/**
 * Legacy adapter for backward compatibility with existing UI.
 * Matches the original projectDeploymentView signature.
 */
export function projectDeploymentView(
  events: GameEvent[],
  battleId?: string,
  providedState?: GameState
): DeploymentView | null {
  const state = providedState ?? rebuildState(events)

  if (!state.currentBattle) {
    return null
  }

  const battle = state.currentBattle
  const targetBattleId = battleId || battle.battleId
  const positions = battle.positions
  const selectedCardIds = battle.selectedCardIds

  // Build card lookup from owned cards
  const cardLookup = new Map<string, DeploymentCardView>()
  for (const card of state.ownedCards) {
    if (selectedCardIds.includes(card.id)) {
      cardLookup.set(card.id, {
        id: card.id,
        name: card.name,
        factionId: card.faction,
        factionIcon: FACTION_ICONS[card.faction],
        factionColor: FACTION_COLORS[card.faction],
        attack: card.attack,
        armor: card.armor,
        agility: card.agility
      })
    }
  }

  // Build slots
  const slots: DeploymentSlot[] = []
  const assignedCardIds = new Set<string>()

  for (let i = 0; i < TOTAL_POSITIONS; i++) {
    const cardId = positions[i]
    const card = cardId ? cardLookup.get(cardId) || null : null

    if (cardId && card) {
      assignedCardIds.add(cardId)
    }

    slots.push({
      position: i + 1,
      card,
      isEmpty: card === null
    })
  }

  // Find unassigned cards
  const unassignedCards: DeploymentCardView[] = []
  for (const cardId of selectedCardIds) {
    if (!assignedCardIds.has(cardId)) {
      const card = cardLookup.get(cardId)
      if (card) {
        unassignedCards.push(card)
      }
    }
  }

  // Determine tactics tip
  const tacticsTip = selectTacticsTip(Array.from(cardLookup.values()))

  // Get battle context from trigger event
  let battleContext = 'Battle awaits'
  const battleEvent = events.find(
    e => e.type === 'BATTLE_TRIGGERED' && e.data.battleId === targetBattleId
  )
  if (battleEvent && battleEvent.type === 'BATTLE_TRIGGERED') {
    battleContext = battleEvent.data.context
  }

  // Calculate assigned count from filled positions (not from unassignedCards)
  const assignedCount = positions.filter(p => p !== null).length

  return {
    slots,
    unassignedCards,
    assignedCount,
    totalSlots: TOTAL_POSITIONS,
    canLockOrders: assignedCount === TOTAL_POSITIONS,
    battleId: targetBattleId,
    battleContext,
    tacticsTip
  }
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function selectTacticsTip(cards: DeploymentCardView[]): string {
  if (cards.length === 0) {
    return TACTICS_TIPS[3]  // Default balanced tip
  }

  // Analyze fleet composition
  const totalAgility = cards.reduce((sum, c) => sum + c.agility, 0)
  const totalArmor = cards.reduce((sum, c) => sum + c.armor, 0)
  const totalAttack = cards.reduce((sum, c) => sum + c.attack, 0)

  const avgAgility = totalAgility / cards.length
  const avgArmor = totalArmor / cards.length
  const avgAttack = totalAttack / cards.length

  // Select tip based on composition
  if (avgAgility > 3.5) {
    return TACTICS_TIPS[4]  // Interceptor tip
  } else if (avgArmor > 4.5) {
    return TACTICS_TIPS[0]  // Tank tip
  } else if (avgAttack > 4) {
    return TACTICS_TIPS[2]  // Glass cannon tip
  } else {
    return TACTICS_TIPS[3]  // Balanced tip
  }
}
