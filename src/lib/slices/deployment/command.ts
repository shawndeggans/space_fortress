// ============================================================================
// DEPLOYMENT SLICE - Command Handlers
// ============================================================================
//
// Handles card deployment for battle:
// - SET_CARD_POSITION: Place a card in a slot (1-5)
// - LOCK_ORDERS: Finalize positions and begin battle execution
//
// Business Rules:
// - Must be in deployment phase with active battle
// - Cards must be from committed fleet
// - Position must be 1-5
// - All 5 positions must be filled to lock orders
// - Repositioning is allowed
// ============================================================================

import type { GameEvent } from '../../game/events'
import type { GamePhase, OwnedCard, Card } from '../../game/types'
import { executeBattle, type BattleContext } from '../../game/combat'
import { generateOpponentFleet, type BattleGenerationContext } from '../../game/opponents'

// ----------------------------------------------------------------------------
// Error Class
// ----------------------------------------------------------------------------

export class DeploymentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DeploymentError'
  }
}

// ----------------------------------------------------------------------------
// Command Types
// ----------------------------------------------------------------------------

export interface SetCardPositionCommand {
  type: 'SET_CARD_POSITION'
  data: {
    cardId: string
    position: number
  }
}

export interface LockOrdersCommand {
  type: 'LOCK_ORDERS'
  data: {
    positions: string[]  // Card IDs in position order (1-5)
  }
}

export type DeploymentCommand =
  | SetCardPositionCommand
  | LockOrdersCommand

// ----------------------------------------------------------------------------
// State Required by Handlers
// ----------------------------------------------------------------------------

export interface DeploymentState {
  currentPhase: GamePhase
  currentBattle: {
    battleId: string
    questId?: string
    context?: string
    opponentType?: string
    difficulty?: 'easy' | 'medium' | 'hard'
    selectedCardIds: string[]
    positions: (string | null)[]
  } | null
  activeQuest?: {
    questId: string
  } | null
  ownedCards: OwnedCard[]
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

export const TOTAL_POSITIONS = 5

// ----------------------------------------------------------------------------
// Helper
// ----------------------------------------------------------------------------

function timestamp(): string {
  return new Date().toISOString()
}

// ----------------------------------------------------------------------------
// Command Factories
// ----------------------------------------------------------------------------

export function createSetCardPositionCommand(cardId: string, position: number): SetCardPositionCommand {
  return { type: 'SET_CARD_POSITION', data: { cardId, position } }
}

export function createLockOrdersCommand(positions: string[]): LockOrdersCommand {
  return { type: 'LOCK_ORDERS', data: { positions } }
}

// ----------------------------------------------------------------------------
// SET_CARD_POSITION Handler
// ----------------------------------------------------------------------------

export function handleSetCardPosition(
  command: SetCardPositionCommand,
  state: DeploymentState
): GameEvent[] {
  // Validate phase
  if (state.currentPhase !== 'deployment') {
    throw new DeploymentError('Not in deployment phase')
  }

  // Validate battle exists
  if (!state.currentBattle) {
    throw new DeploymentError('No active battle')
  }

  // Validate position range
  if (command.data.position < 1 || command.data.position > 5) {
    throw new DeploymentError('Position must be 1-5')
  }

  // Validate card is in selected fleet
  if (!state.currentBattle.selectedCardIds.includes(command.data.cardId)) {
    throw new DeploymentError('Card not in selected fleet')
  }

  return [
    {
      type: 'CARD_POSITIONED',
      data: {
        timestamp: timestamp(),
        cardId: command.data.cardId,
        position: command.data.position,
        battleId: state.currentBattle.battleId
      }
    }
  ]
}

// ----------------------------------------------------------------------------
// LOCK_ORDERS Handler
// ----------------------------------------------------------------------------

export function handleLockOrders(
  command: LockOrdersCommand,
  state: DeploymentState
): GameEvent[] {
  // Validate phase
  if (state.currentPhase !== 'deployment') {
    throw new DeploymentError('Not in deployment phase')
  }

  // Validate battle exists
  if (!state.currentBattle) {
    throw new DeploymentError('No active battle')
  }

  // Get positions from command data
  const positions = command.data.positions

  // Verify exactly 5 positions are provided
  if (!positions || positions.length !== TOTAL_POSITIONS) {
    throw new DeploymentError('All 5 positions must be filled')
  }

  // Verify all positions are valid card IDs (not null/undefined)
  if (positions.some(p => !p)) {
    throw new DeploymentError('All 5 positions must be filled')
  }

  const ts = timestamp()
  const events: GameEvent[] = []

  // First emit ORDERS_LOCKED
  events.push({
    type: 'ORDERS_LOCKED',
    data: {
      timestamp: ts,
      battleId: state.currentBattle.battleId,
      positions: positions as string[]
    }
  })

  // Transition to battle phase BEFORE battle events
  events.push({
    type: 'PHASE_CHANGED',
    data: {
      timestamp: ts,
      fromPhase: 'deployment',
      toPhase: 'battle'
    }
  })

  // Build player fleet from positions (order matters!)
  const playerFleet: Card[] = (positions as string[]).map(cardId => {
    const card = state.ownedCards.find(c => c.id === cardId)
    if (!card) {
      throw new DeploymentError(`Card not found in owned cards: ${cardId}`)
    }
    return {
      id: card.id,
      name: card.name,
      faction: card.faction,
      attack: card.attack,
      defense: card.defense,
      hull: card.hull,
      agility: card.agility,
      energyCost: card.energyCost,
      abilities: card.abilities
    }
  })

  // Generate opponent fleet based on battle context
  const generationContext: BattleGenerationContext = {
    questId: state.currentBattle.questId || state.activeQuest?.questId || 'unknown',
    opponentType: state.currentBattle.opponentType || 'scavengers',
    difficulty: state.currentBattle.difficulty || 'medium'
  }
  const opponentFleet = generateOpponentFleet(generationContext)

  // Execute the battle and generate all battle events
  const battleContext: BattleContext = {
    battleId: state.currentBattle.battleId,
    questId: state.currentBattle.questId || state.activeQuest?.questId || 'unknown',
    context: state.currentBattle.context || 'Combat engagement',
    timestamp: ts
  }
  const { events: battleEvents } = executeBattle(
    battleContext,
    playerFleet,
    opponentFleet.cards
  )

  // Add all battle events
  events.push(...battleEvents)

  // Transition from battle to consequence phase AFTER battle resolves
  const postBattleTs = new Date(new Date(ts).getTime() + 7000).toISOString()
  events.push({
    type: 'PHASE_CHANGED',
    data: {
      timestamp: postBattleTs,
      fromPhase: 'battle',
      toPhase: 'consequence'
    }
  })

  return events
}
