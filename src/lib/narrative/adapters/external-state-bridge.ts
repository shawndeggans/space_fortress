// ============================================================================
// EXTERNAL STATE BRIDGE
// ============================================================================
//
// Connects narrative conditions to game state.
// Enables condition evaluation against GameState for external conditions.
//
// ============================================================================

import type { GameState, FactionId } from '../../game/types'
import type { ExternalStateProvider, ExternalConditionType } from '../types'

// ----------------------------------------------------------------------------
// External Condition Types
// ----------------------------------------------------------------------------

export interface ReputationConditionParams {
  factionId: FactionId
  value: number
}

export interface CardConditionParams {
  cardId: string
}

export interface CardCountConditionParams {
  count: number
}

export interface BountyConditionParams {
  amount: number
}

export interface QuestConditionParams {
  questId: string
}

export interface AllianceConditionParams {
  factionId: FactionId
}

export interface BattleOutcomeConditionParams {
  outcome: 'victory' | 'defeat' | 'draw'
}

// ----------------------------------------------------------------------------
// State Bridge Implementation
// ----------------------------------------------------------------------------

/**
 * Create an ExternalStateProvider that evaluates conditions against GameState.
 */
export function createExternalStateBridge(getState: () => GameState): ExternalStateProvider {
  return {
    evaluateExternalCondition(
      conditionId: string,
      playerId: string,
      params: Record<string, unknown>
    ): boolean {
      const state = getState()
      return evaluateCondition(state, conditionId as ExternalConditionType, params)
    },

    onNarrativeEvent(event: unknown): void {
      // This can be extended to notify the game of narrative events
      // For now, we just log it for debugging
      if (process.env.NODE_ENV === 'development') {
        console.debug('[NarrativeEvent]', event)
      }
    }
  }
}

// ----------------------------------------------------------------------------
// Condition Evaluation
// ----------------------------------------------------------------------------

function evaluateCondition(
  state: GameState,
  conditionType: ExternalConditionType,
  params: Record<string, unknown>
): boolean {
  switch (conditionType) {
    case 'reputation_gte':
      return evaluateReputationGte(state, params as unknown as ReputationConditionParams)

    case 'reputation_lte':
      return evaluateReputationLte(state, params as unknown as ReputationConditionParams)

    case 'has_card':
      return evaluateHasCard(state, params as unknown as CardConditionParams)

    case 'card_count_gte':
      return evaluateCardCountGte(state, params as unknown as CardCountConditionParams)

    case 'bounty_gte':
      return evaluateBountyGte(state, params as unknown as BountyConditionParams)

    case 'quest_completed':
      return evaluateQuestCompleted(state, params as unknown as QuestConditionParams)

    case 'alliance_formed':
      return evaluateAllianceFormed(state, params as unknown as AllianceConditionParams)

    case 'battle_outcome':
      return evaluateBattleOutcome(state, params as unknown as BattleOutcomeConditionParams)

    default:
      console.warn(`Unknown external condition type: ${conditionType}`)
      return false
  }
}

// ----------------------------------------------------------------------------
// Individual Condition Evaluators
// ----------------------------------------------------------------------------

function evaluateReputationGte(
  state: GameState,
  params: ReputationConditionParams
): boolean {
  const rep = state.reputation[params.factionId] ?? 0
  return rep >= params.value
}

function evaluateReputationLte(
  state: GameState,
  params: ReputationConditionParams
): boolean {
  const rep = state.reputation[params.factionId] ?? 0
  return rep <= params.value
}

function evaluateHasCard(
  state: GameState,
  params: CardConditionParams
): boolean {
  return state.ownedCards.some(card => card.id === params.cardId)
}

function evaluateCardCountGte(
  state: GameState,
  params: CardCountConditionParams
): boolean {
  return state.ownedCards.length >= params.count
}

function evaluateBountyGte(
  state: GameState,
  params: BountyConditionParams
): boolean {
  return state.bounty >= params.amount
}

function evaluateQuestCompleted(
  state: GameState,
  params: QuestConditionParams
): boolean {
  return state.completedQuests.some(q => q.questId === params.questId)
}

function evaluateAllianceFormed(
  state: GameState,
  params: AllianceConditionParams
): boolean {
  if (!state.activeQuest) return false
  return state.activeQuest.alliances.some(a => a.faction === params.factionId)
}

function evaluateBattleOutcome(
  state: GameState,
  params: BattleOutcomeConditionParams
): boolean {
  // Check most recent battle result
  if (!state.currentBattle || !state.currentBattle.outcome) return false
  return state.currentBattle.outcome === params.outcome
}

// ----------------------------------------------------------------------------
// Flag Bridge
// ----------------------------------------------------------------------------

/**
 * Get narrative flags from game state.
 * Maps game state flags to narrative flag format.
 */
export function getNarrativeFlags(state: GameState): Map<string, unknown> {
  const flags = new Map<string, unknown>()

  // Add choice history flags
  for (const entry of state.choiceHistory) {
    flags.set(`choice_${entry.choiceId}`, true)
    flags.set(`dilemma_${entry.dilemmaId}_completed`, true)
  }

  // Add quest completion flags
  for (const quest of state.completedQuests) {
    flags.set(`quest_${quest.questId}_completed`, true)
    flags.set(`quest_${quest.questId}_outcome_${quest.outcome}`, true)
  }

  // Add battle outcome flags
  if (state.currentBattle?.outcome) {
    flags.set(`last_battle_${state.currentBattle.outcome}`, true)
  }

  // Add reputation threshold flags
  for (const [faction, value] of Object.entries(state.reputation)) {
    const numValue = value as number
    if (numValue >= 50) flags.set(`${faction}_allied`, true)
    if (numValue <= -50) flags.set(`${faction}_hostile`, true)
  }

  // Add card ownership flags
  for (const card of state.ownedCards) {
    flags.set(`owns_card_${card.id}`, true)
  }

  return flags
}

// ----------------------------------------------------------------------------
// State Queries
// ----------------------------------------------------------------------------

/**
 * Query interface for narrative system to access game state.
 */
export interface NarrativeStateQueries {
  getReputation(factionId: FactionId): number
  hasCard(cardId: string): boolean
  getCardCount(): number
  getBounty(): number
  hasCompletedQuest(questId: string): boolean
  hasAlliance(factionId: FactionId): boolean
  getLastBattleOutcome(): 'victory' | 'defeat' | 'draw' | null
  getFlags(): Map<string, unknown>
}

/**
 * Create query interface from game state.
 */
export function createStateQueries(state: GameState): NarrativeStateQueries {
  return {
    getReputation(factionId: FactionId): number {
      return state.reputation[factionId] ?? 0
    },

    hasCard(cardId: string): boolean {
      return state.ownedCards.some(c => c.id === cardId)
    },

    getCardCount(): number {
      return state.ownedCards.length
    },

    getBounty(): number {
      return state.bounty
    },

    hasCompletedQuest(questId: string): boolean {
      return state.completedQuests.some(q => q.questId === questId)
    },

    hasAlliance(factionId: FactionId): boolean {
      if (!state.activeQuest) return false
      return state.activeQuest.alliances.some(a => a.faction === factionId)
    },

    getLastBattleOutcome(): 'victory' | 'defeat' | 'draw' | null {
      return state.currentBattle?.outcome ?? null
    },

    getFlags(): Map<string, unknown> {
      return getNarrativeFlags(state)
    }
  }
}
