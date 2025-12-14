// ============================================================================
// SPACE FORTRESS - Deployment View Projection
// ============================================================================
//
// Projects the deployment screen data including:
// - 5 numbered slots with assigned cards
// - Unassigned cards
// - Lock orders availability
//
// Used by: Deployment screen
// ============================================================================

import type { GameEvent } from '../events'
import type { FactionId, Card , GameState } from '../types'
import { rebuildState } from '../projections'

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

export interface DeploymentViewData {
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

const TOTAL_SLOTS = 5

// Tactics tips based on fleet composition
const TACTICS_TIPS = [
  'High agility cards strike first. Consider leading with tanks to absorb enemy alpha strikes.',
  'Position high-armor cards against predicted enemy glass cannons.',
  'Save your highest attack cards for positions where you expect enemy tanks.',
  'A balanced fleet can adapt to any opponent. Consider spreading your stats.',
  'If you have interceptors, position them early to take advantage of first strike.'
]

// ----------------------------------------------------------------------------
// Projection Function
// ----------------------------------------------------------------------------

export function projectDeploymentView(events: GameEvent[], battleId?: string, providedState?: GameState): DeploymentViewData | null {
  const state = providedState ?? rebuildState(events)

  if (!state.currentBattle) {
    return null
  }

  const battle = state.currentBattle
  const targetBattleId = battleId || battle.battleId

  // Get the cards from positions array
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

  for (let i = 0; i < TOTAL_SLOTS; i++) {
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

  // Get battle context from trigger event
  let battleContext = 'Battle awaits'
  const battleEvent = events.find(
    e => e.type === 'BATTLE_TRIGGERED' && e.data.battleId === targetBattleId
  )
  if (battleEvent && battleEvent.type === 'BATTLE_TRIGGERED') {
    battleContext = battleEvent.data.context
  }

  const assignedCount = TOTAL_SLOTS - unassignedCards.length

  return {
    slots,
    unassignedCards,
    assignedCount,
    totalSlots: TOTAL_SLOTS,
    canLockOrders: assignedCount === TOTAL_SLOTS,
    battleId: targetBattleId,
    battleContext,
    tacticsTip
  }
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function selectTacticsTip(cards: DeploymentCardView[]): string {
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
