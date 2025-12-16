// ============================================================================
// NARRATIVE CONDITIONS
// ============================================================================
//
// Re-exports condition types from graph.ts and adds evaluation utilities.
// Conditions are evaluated against PlayerNarrativeState.
//
// ============================================================================

export {
  type ConditionExpression,
  type SimpleCondition,
  type CompoundCondition,
  type SimpleConditionType,
  type ConditionDefinition,
  type ConditionResult
} from './graph'

// ----------------------------------------------------------------------------
// External Condition Types (Integration with Game State)
// ----------------------------------------------------------------------------

/**
 * External conditions that bridge to the game's state system.
 * These are resolved by the ExternalStateProvider.
 */
export type ExternalConditionType =
  | 'reputation_gte'      // { factionId: string, value: number }
  | 'reputation_lte'      // { factionId: string, value: number }
  | 'has_card'            // { cardId: string }
  | 'card_count_gte'      // { count: number }
  | 'bounty_gte'          // { amount: number }
  | 'quest_completed'     // { questId: string }
  | 'alliance_formed'     // { factionId: string }
  | 'battle_outcome'      // { outcome: 'victory' | 'defeat' | 'draw' }

/**
 * External state provider interface.
 * Bridges narrative conditions to game state queries.
 */
export interface ExternalStateProvider {
  /**
   * Query game state for condition evaluation
   */
  evaluateExternalCondition(
    conditionId: string,
    playerId: string,
    params: Record<string, unknown>
  ): boolean

  /**
   * Notify game of narrative events
   */
  onNarrativeEvent?(event: unknown): void
}

// ----------------------------------------------------------------------------
// Condition Evaluation Helpers
// ----------------------------------------------------------------------------

/**
 * Check if a condition is a simple condition
 */
export function isSimpleCondition(expr: import('./graph').ConditionExpression): expr is import('./graph').SimpleCondition {
  return expr.type === 'simple'
}

/**
 * Check if a condition is a compound condition
 */
export function isCompoundCondition(expr: import('./graph').ConditionExpression): expr is import('./graph').CompoundCondition {
  return expr.type === 'compound'
}

/**
 * Create a simple flag check condition
 */
export function hasFlag(flag: string): import('./graph').SimpleCondition {
  return {
    type: 'simple',
    conditionType: 'has_flag',
    params: { flag }
  }
}

/**
 * Create a simple lacks flag condition
 */
export function lacksFlag(flag: string): import('./graph').SimpleCondition {
  return {
    type: 'simple',
    conditionType: 'lacks_flag',
    params: { flag }
  }
}

/**
 * Create a visited node condition
 */
export function visitedNode(nodeId: string): import('./graph').SimpleCondition {
  return {
    type: 'simple',
    conditionType: 'visited_node',
    params: { nodeId }
  }
}

/**
 * Create an AND compound condition
 */
export function allOf(...conditions: import('./graph').ConditionExpression[]): import('./graph').CompoundCondition {
  return {
    type: 'compound',
    operator: 'and',
    conditions
  }
}

/**
 * Create an OR compound condition
 */
export function anyOf(...conditions: import('./graph').ConditionExpression[]): import('./graph').CompoundCondition {
  return {
    type: 'compound',
    operator: 'or',
    conditions
  }
}

/**
 * Create a NOT compound condition
 */
export function not(condition: import('./graph').ConditionExpression): import('./graph').CompoundCondition {
  return {
    type: 'compound',
    operator: 'not',
    conditions: [condition]
  }
}

/**
 * Create an external condition (evaluated by game state)
 */
export function external(conditionId: string, params: Record<string, unknown> = {}): import('./graph').SimpleCondition {
  return {
    type: 'simple',
    conditionType: 'external',
    params: { conditionId, ...params }
  }
}
