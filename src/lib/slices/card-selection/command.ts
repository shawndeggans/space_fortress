// ============================================================================
// CARD-SELECTION SLICE - Command Handlers
// ============================================================================
//
// Handles card selection for battle:
// - SELECT_CARD: Add a card to fleet selection
// - DESELECT_CARD: Remove a card from fleet selection
// - COMMIT_FLEET: Lock in selected cards and proceed to deployment
//
// Business Rules:
// - Must be in card_selection phase with active battle
// - Maximum 5 cards can be selected
// - Cannot select locked cards
// - Must have exactly 5 cards to commit fleet
// ============================================================================

import type { GameEvent } from '../../game/events'
import type { GamePhase, FactionId, OwnedCard } from '../../game/types'

// ----------------------------------------------------------------------------
// Error Class
// ----------------------------------------------------------------------------

export class CardSelectionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CardSelectionError'
  }
}

// ----------------------------------------------------------------------------
// Command Types
// ----------------------------------------------------------------------------

export interface SelectCardCommand {
  type: 'SELECT_CARD'
  data: {
    cardId: string
  }
}

export interface DeselectCardCommand {
  type: 'DESELECT_CARD'
  data: {
    cardId: string
  }
}

export interface CommitFleetCommand {
  type: 'COMMIT_FLEET'
  data: {
    cardIds: string[]
  }
}

export type CardSelectionCommand =
  | SelectCardCommand
  | DeselectCardCommand
  | CommitFleetCommand

// ----------------------------------------------------------------------------
// State Required by Handlers
// ----------------------------------------------------------------------------

export interface CardSelectionState {
  gameStatus: 'not_started' | 'in_progress' | 'completed'
  currentPhase: GamePhase
  ownedCards: OwnedCard[]
  currentBattle: {
    battleId: string
    selectedCardIds: string[]
  } | null
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

export const MAX_FLEET_SIZE = 5

// ----------------------------------------------------------------------------
// Helper
// ----------------------------------------------------------------------------

function timestamp(): string {
  return new Date().toISOString()
}

// ----------------------------------------------------------------------------
// Command Factories
// ----------------------------------------------------------------------------

export function createSelectCardCommand(cardId: string): SelectCardCommand {
  return { type: 'SELECT_CARD', data: { cardId } }
}

export function createDeselectCardCommand(cardId: string): DeselectCardCommand {
  return { type: 'DESELECT_CARD', data: { cardId } }
}

export function createCommitFleetCommand(cardIds: string[]): CommitFleetCommand {
  return { type: 'COMMIT_FLEET', data: { cardIds } }
}

// ----------------------------------------------------------------------------
// SELECT_CARD Handler
// ----------------------------------------------------------------------------

export function handleSelectCard(
  command: SelectCardCommand,
  state: CardSelectionState
): GameEvent[] {
  // Validate phase
  if (state.currentPhase !== 'card_selection') {
    throw new CardSelectionError('Not in card selection phase')
  }

  // Validate battle exists
  if (!state.currentBattle) {
    throw new CardSelectionError('No active battle')
  }

  // Validate not at max capacity
  if (state.currentBattle.selectedCardIds.length >= MAX_FLEET_SIZE) {
    throw new CardSelectionError('Already selected 5 cards')
  }

  // Validate card not already selected
  if (state.currentBattle.selectedCardIds.includes(command.data.cardId)) {
    throw new CardSelectionError('Card already selected')
  }

  // Validate card is owned
  const card = state.ownedCards.find(c => c.id === command.data.cardId)
  if (!card) {
    throw new CardSelectionError('Card not owned')
  }

  // Validate card is not locked
  if (card.isLocked) {
    throw new CardSelectionError('Card is locked')
  }

  return [
    {
      type: 'CARD_SELECTED',
      data: {
        timestamp: timestamp(),
        cardId: command.data.cardId,
        battleId: state.currentBattle.battleId
      }
    }
  ]
}

// ----------------------------------------------------------------------------
// DESELECT_CARD Handler
// ----------------------------------------------------------------------------

export function handleDeselectCard(
  command: DeselectCardCommand,
  state: CardSelectionState
): GameEvent[] {
  // Validate phase
  if (state.currentPhase !== 'card_selection') {
    throw new CardSelectionError('Not in card selection phase')
  }

  // Validate battle exists
  if (!state.currentBattle) {
    throw new CardSelectionError('No active battle')
  }

  // Validate card is selected
  if (!state.currentBattle.selectedCardIds.includes(command.data.cardId)) {
    throw new CardSelectionError('Card not selected')
  }

  return [
    {
      type: 'CARD_DESELECTED',
      data: {
        timestamp: timestamp(),
        cardId: command.data.cardId,
        battleId: state.currentBattle.battleId
      }
    }
  ]
}

// ----------------------------------------------------------------------------
// COMMIT_FLEET Handler
// ----------------------------------------------------------------------------

export function handleCommitFleet(
  command: CommitFleetCommand,
  state: CardSelectionState
): GameEvent[] {
  // Validate phase
  if (state.currentPhase !== 'card_selection') {
    throw new CardSelectionError('Not in card selection phase')
  }

  // Validate battle exists
  if (!state.currentBattle) {
    throw new CardSelectionError('No active battle')
  }

  const cardIds = command.data.cardIds

  // Validate exact fleet size
  if (cardIds.length !== MAX_FLEET_SIZE) {
    throw new CardSelectionError('Must select exactly 5 cards')
  }

  // Validate all cards are owned and not locked
  for (const cardId of cardIds) {
    const card = state.ownedCards.find(c => c.id === cardId)
    if (!card) {
      throw new CardSelectionError(`Card not owned: ${cardId}`)
    }
    if (card.isLocked) {
      throw new CardSelectionError(`Card is locked: ${cardId}`)
    }
  }

  const ts = timestamp()

  return [
    {
      type: 'FLEET_COMMITTED',
      data: {
        timestamp: ts,
        battleId: state.currentBattle.battleId,
        cardIds
      }
    },
    {
      type: 'PHASE_CHANGED',
      data: {
        timestamp: ts,
        fromPhase: 'card_selection',
        toPhase: 'deployment'
      }
    }
  ]
}
