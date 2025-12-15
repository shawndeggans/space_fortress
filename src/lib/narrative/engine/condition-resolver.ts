// ============================================================================
// CONDITION RESOLVER
// ============================================================================
//
// Evaluates narrative conditions against state.
// Supports simple conditions, compound conditions, and external conditions.
//
// ============================================================================

import type {
  ConditionExpression,
  SimpleCondition,
  CompoundCondition,
  SimpleConditionType,
  ConditionResult,
  ExternalStateProvider,
  NodeId
} from '../types'
import type { PlayerNarrativeState } from '../types/state'

// ----------------------------------------------------------------------------
// Resolver Interface
// ----------------------------------------------------------------------------

export interface ConditionResolver {
  /**
   * Evaluate a condition expression against state.
   */
  evaluate(
    condition: ConditionExpression,
    state: PlayerNarrativeState,
    playerId: string
  ): ConditionResult

  /**
   * Check if a condition is satisfied (simple boolean result).
   */
  isSatisfied(
    condition: ConditionExpression,
    state: PlayerNarrativeState,
    playerId: string
  ): boolean
}

// ----------------------------------------------------------------------------
// Resolver Implementation
// ----------------------------------------------------------------------------

/**
 * Create a condition resolver with optional external state provider.
 */
export function createConditionResolver(
  externalProvider?: ExternalStateProvider
): ConditionResolver {
  return {
    evaluate(
      condition: ConditionExpression,
      state: PlayerNarrativeState,
      playerId: string
    ): ConditionResult {
      return evaluateCondition(condition, state, playerId, externalProvider)
    },

    isSatisfied(
      condition: ConditionExpression,
      state: PlayerNarrativeState,
      playerId: string
    ): boolean {
      return evaluateCondition(condition, state, playerId, externalProvider).satisfied
    }
  }
}

// ----------------------------------------------------------------------------
// Core Evaluation Logic
// ----------------------------------------------------------------------------

function evaluateCondition(
  condition: ConditionExpression,
  state: PlayerNarrativeState,
  playerId: string,
  externalProvider?: ExternalStateProvider
): ConditionResult {
  if (condition.type === 'simple') {
    return evaluateSimpleCondition(condition, state, playerId, externalProvider)
  } else {
    return evaluateCompoundCondition(condition, state, playerId, externalProvider)
  }
}

function evaluateSimpleCondition(
  condition: SimpleCondition,
  state: PlayerNarrativeState,
  playerId: string,
  externalProvider?: ExternalStateProvider
): ConditionResult {
  const { conditionType, params } = condition

  switch (conditionType) {
    case 'has_flag':
      return evaluateHasFlag(state, params.flag as string)

    case 'lacks_flag':
      return evaluateLacksFlag(state, params.flag as string)

    case 'visited_node':
      return evaluateVisitedNode(state, params.nodeId as NodeId)

    case 'not_visited_node':
      return evaluateNotVisitedNode(state, params.nodeId as NodeId)

    case 'visit_count':
      return evaluateVisitCount(
        state,
        params.nodeId as NodeId,
        params.operator as string,
        params.value as number
      )

    case 'flag_value':
      return evaluateFlagValue(
        state,
        params.flag as string,
        params.operator as string,
        params.value as unknown
      )

    case 'random':
      return evaluateRandom(params.probability as number)

    case 'external':
      return evaluateExternalCondition(
        params.conditionId as string,
        playerId,
        params,
        externalProvider
      )

    default:
      return {
        satisfied: false,
        failedConditions: [`Unknown condition type: ${conditionType}`]
      }
  }
}

function evaluateCompoundCondition(
  condition: CompoundCondition,
  state: PlayerNarrativeState,
  playerId: string,
  externalProvider?: ExternalStateProvider
): ConditionResult {
  const { operator, conditions } = condition

  switch (operator) {
    case 'and':
      return evaluateAndConditions(conditions, state, playerId, externalProvider)

    case 'or':
      return evaluateOrConditions(conditions, state, playerId, externalProvider)

    case 'not':
      return evaluateNotCondition(conditions[0], state, playerId, externalProvider)

    default:
      return {
        satisfied: false,
        failedConditions: [`Unknown operator: ${operator}`]
      }
  }
}

// ----------------------------------------------------------------------------
// Simple Condition Evaluators
// ----------------------------------------------------------------------------

function evaluateHasFlag(state: PlayerNarrativeState, flag: string): ConditionResult {
  const hasFlag = state.flags.has(flag)
  return {
    satisfied: hasFlag,
    failedConditions: hasFlag ? [] : [`Missing flag: ${flag}`]
  }
}

function evaluateLacksFlag(state: PlayerNarrativeState, flag: string): ConditionResult {
  const lacksFlag = !state.flags.has(flag)
  return {
    satisfied: lacksFlag,
    failedConditions: lacksFlag ? [] : [`Has unwanted flag: ${flag}`]
  }
}

function evaluateVisitedNode(state: PlayerNarrativeState, nodeId: NodeId): ConditionResult {
  const visited = state.visitedNodes.has(nodeId)
  return {
    satisfied: visited,
    failedConditions: visited ? [] : [`Node not visited: ${nodeId}`]
  }
}

function evaluateNotVisitedNode(state: PlayerNarrativeState, nodeId: NodeId): ConditionResult {
  const notVisited = !state.visitedNodes.has(nodeId)
  return {
    satisfied: notVisited,
    failedConditions: notVisited ? [] : [`Node already visited: ${nodeId}`]
  }
}

function evaluateVisitCount(
  state: PlayerNarrativeState,
  nodeId: NodeId,
  operator: string,
  value: number
): ConditionResult {
  const visitRecord = state.visitedNodes.get(nodeId)
  const count = visitRecord?.visitCount ?? 0

  let satisfied: boolean
  switch (operator) {
    case '>':
      satisfied = count > value
      break
    case '<':
      satisfied = count < value
      break
    case '>=':
      satisfied = count >= value
      break
    case '<=':
      satisfied = count <= value
      break
    case '==':
      satisfied = count === value
      break
    case '!=':
      satisfied = count !== value
      break
    default:
      satisfied = false
  }

  return {
    satisfied,
    failedConditions: satisfied ? [] : [`Visit count check failed: ${nodeId} ${operator} ${value} (actual: ${count})`]
  }
}

function evaluateFlagValue(
  state: PlayerNarrativeState,
  flag: string,
  operator: string,
  value: unknown
): ConditionResult {
  const flagValue = state.flags.get(flag)

  let satisfied: boolean
  switch (operator) {
    case '==':
      satisfied = flagValue === value
      break
    case '!=':
      satisfied = flagValue !== value
      break
    case '>':
      satisfied = (flagValue as number) > (value as number)
      break
    case '<':
      satisfied = (flagValue as number) < (value as number)
      break
    case '>=':
      satisfied = (flagValue as number) >= (value as number)
      break
    case '<=':
      satisfied = (flagValue as number) <= (value as number)
      break
    default:
      satisfied = false
  }

  return {
    satisfied,
    failedConditions: satisfied ? [] : [`Flag value check failed: ${flag} ${operator} ${value}`]
  }
}

function evaluateRandom(probability: number): ConditionResult {
  const roll = Math.random()
  const satisfied = roll < probability
  return {
    satisfied,
    failedConditions: satisfied ? [] : [`Random check failed (${probability * 100}%)`]
  }
}

function evaluateExternalCondition(
  conditionId: string,
  playerId: string,
  params: Record<string, unknown>,
  externalProvider?: ExternalStateProvider
): ConditionResult {
  if (!externalProvider) {
    return {
      satisfied: false,
      failedConditions: [`No external provider for condition: ${conditionId}`]
    }
  }

  const satisfied = externalProvider.evaluateExternalCondition(conditionId, playerId, params)
  return {
    satisfied,
    failedConditions: satisfied ? [] : [`External condition failed: ${conditionId}`]
  }
}

// ----------------------------------------------------------------------------
// Compound Condition Evaluators
// ----------------------------------------------------------------------------

function evaluateAndConditions(
  conditions: ConditionExpression[],
  state: PlayerNarrativeState,
  playerId: string,
  externalProvider?: ExternalStateProvider
): ConditionResult {
  const failedConditions: string[] = []

  for (const condition of conditions) {
    const result = evaluateCondition(condition, state, playerId, externalProvider)
    if (!result.satisfied) {
      failedConditions.push(...result.failedConditions)
    }
  }

  return {
    satisfied: failedConditions.length === 0,
    failedConditions
  }
}

function evaluateOrConditions(
  conditions: ConditionExpression[],
  state: PlayerNarrativeState,
  playerId: string,
  externalProvider?: ExternalStateProvider
): ConditionResult {
  const failedConditions: string[] = []

  for (const condition of conditions) {
    const result = evaluateCondition(condition, state, playerId, externalProvider)
    if (result.satisfied) {
      return { satisfied: true, failedConditions: [] }
    }
    failedConditions.push(...result.failedConditions)
  }

  return {
    satisfied: false,
    failedConditions: [`None of the OR conditions were satisfied`]
  }
}

function evaluateNotCondition(
  condition: ConditionExpression,
  state: PlayerNarrativeState,
  playerId: string,
  externalProvider?: ExternalStateProvider
): ConditionResult {
  const result = evaluateCondition(condition, state, playerId, externalProvider)
  return {
    satisfied: !result.satisfied,
    failedConditions: result.satisfied ? [`NOT condition failed`] : []
  }
}
