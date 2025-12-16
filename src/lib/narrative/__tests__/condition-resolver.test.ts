// ============================================================================
// CONDITION RESOLVER - Tests
// ============================================================================

import { describe, it, expect } from 'vitest'
import { createConditionResolver } from '../engine/condition-resolver'
import type { PlayerNarrativeState } from '../types/state'
import type { ConditionExpression } from '../types'
import { hasFlag, lacksFlag, visitedNode, allOf, anyOf, not } from '../types/conditions'

// ----------------------------------------------------------------------------
// Test Helpers
// ----------------------------------------------------------------------------

function createTestState(overrides: Partial<PlayerNarrativeState> = {}): PlayerNarrativeState {
  return {
    sessionId: 'test-session',
    playerId: 'test-player',
    graphId: 'test-graph',
    graphVersion: '1.0.0',
    currentNodeId: 'node-1',
    visitedNodes: new Map(),
    transitionHistory: [],
    flags: new Map(),
    lastCheckpointId: null,
    sessionStatus: 'active',
    startedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    ...overrides
  }
}

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

describe('Condition Resolver', () => {
  const resolver = createConditionResolver()

  describe('Simple Conditions', () => {
    describe('has_flag', () => {
      it('returns satisfied when flag exists', () => {
        const state = createTestState({
          flags: new Map([['test_flag', true]])
        })
        const condition = hasFlag('test_flag')

        const result = resolver.evaluate(condition, state, 'player-1')

        expect(result.satisfied).toBe(true)
        expect(result.failedConditions).toHaveLength(0)
      })

      it('returns not satisfied when flag missing', () => {
        const state = createTestState()
        const condition = hasFlag('missing_flag')

        const result = resolver.evaluate(condition, state, 'player-1')

        expect(result.satisfied).toBe(false)
        expect(result.failedConditions).toContain('Missing flag: missing_flag')
      })
    })

    describe('lacks_flag', () => {
      it('returns satisfied when flag missing', () => {
        const state = createTestState()
        const condition = lacksFlag('missing_flag')

        const result = resolver.evaluate(condition, state, 'player-1')

        expect(result.satisfied).toBe(true)
      })

      it('returns not satisfied when flag exists', () => {
        const state = createTestState({
          flags: new Map([['unwanted_flag', true]])
        })
        const condition = lacksFlag('unwanted_flag')

        const result = resolver.evaluate(condition, state, 'player-1')

        expect(result.satisfied).toBe(false)
        expect(result.failedConditions).toContain('Has unwanted flag: unwanted_flag')
      })
    })

    describe('visited_node', () => {
      it('returns satisfied when node visited', () => {
        const state = createTestState({
          visitedNodes: new Map([
            ['visited-node', { nodeId: 'visited-node', visitCount: 1, firstVisitAt: '', lastVisitAt: '' }]
          ])
        })
        const condition = visitedNode('visited-node')

        const result = resolver.evaluate(condition, state, 'player-1')

        expect(result.satisfied).toBe(true)
      })

      it('returns not satisfied when node not visited', () => {
        const state = createTestState()
        const condition = visitedNode('unvisited-node')

        const result = resolver.evaluate(condition, state, 'player-1')

        expect(result.satisfied).toBe(false)
      })
    })

    describe('visit_count', () => {
      it('evaluates > operator correctly', () => {
        const state = createTestState({
          visitedNodes: new Map([
            ['node-1', { nodeId: 'node-1', visitCount: 3, firstVisitAt: '', lastVisitAt: '' }]
          ])
        })
        const condition: ConditionExpression = {
          type: 'simple',
          conditionType: 'visit_count',
          params: { nodeId: 'node-1', operator: '>', value: 2 }
        }

        expect(resolver.isSatisfied(condition, state, 'player-1')).toBe(true)

        const condition2: ConditionExpression = {
          type: 'simple',
          conditionType: 'visit_count',
          params: { nodeId: 'node-1', operator: '>', value: 3 }
        }
        expect(resolver.isSatisfied(condition2, state, 'player-1')).toBe(false)
      })

      it('evaluates == operator correctly', () => {
        const state = createTestState({
          visitedNodes: new Map([
            ['node-1', { nodeId: 'node-1', visitCount: 2, firstVisitAt: '', lastVisitAt: '' }]
          ])
        })
        const condition: ConditionExpression = {
          type: 'simple',
          conditionType: 'visit_count',
          params: { nodeId: 'node-1', operator: '==', value: 2 }
        }

        expect(resolver.isSatisfied(condition, state, 'player-1')).toBe(true)
      })
    })
  })

  describe('Compound Conditions', () => {
    describe('AND', () => {
      it('returns satisfied when all conditions met', () => {
        const state = createTestState({
          flags: new Map([['flag_a', true], ['flag_b', true]])
        })
        const condition = allOf(hasFlag('flag_a'), hasFlag('flag_b'))

        const result = resolver.evaluate(condition, state, 'player-1')

        expect(result.satisfied).toBe(true)
      })

      it('returns not satisfied when one condition fails', () => {
        const state = createTestState({
          flags: new Map([['flag_a', true]])
        })
        const condition = allOf(hasFlag('flag_a'), hasFlag('flag_b'))

        const result = resolver.evaluate(condition, state, 'player-1')

        expect(result.satisfied).toBe(false)
        expect(result.failedConditions).toContain('Missing flag: flag_b')
      })
    })

    describe('OR', () => {
      it('returns satisfied when any condition met', () => {
        const state = createTestState({
          flags: new Map([['flag_a', true]])
        })
        const condition = anyOf(hasFlag('flag_a'), hasFlag('flag_b'))

        const result = resolver.evaluate(condition, state, 'player-1')

        expect(result.satisfied).toBe(true)
      })

      it('returns not satisfied when no conditions met', () => {
        const state = createTestState()
        const condition = anyOf(hasFlag('flag_a'), hasFlag('flag_b'))

        const result = resolver.evaluate(condition, state, 'player-1')

        expect(result.satisfied).toBe(false)
      })
    })

    describe('NOT', () => {
      it('inverts satisfied condition', () => {
        const state = createTestState({
          flags: new Map([['flag_a', true]])
        })
        const condition = not(hasFlag('flag_a'))

        const result = resolver.evaluate(condition, state, 'player-1')

        expect(result.satisfied).toBe(false)
      })

      it('inverts not satisfied condition', () => {
        const state = createTestState()
        const condition = not(hasFlag('flag_a'))

        const result = resolver.evaluate(condition, state, 'player-1')

        expect(result.satisfied).toBe(true)
      })
    })

    describe('Nested Conditions', () => {
      it('evaluates complex nested conditions', () => {
        // (A AND B) OR C
        const state = createTestState({
          flags: new Map([['flag_c', true]])
        })
        const condition = anyOf(
          allOf(hasFlag('flag_a'), hasFlag('flag_b')),
          hasFlag('flag_c')
        )

        const result = resolver.evaluate(condition, state, 'player-1')

        expect(result.satisfied).toBe(true)
      })

      it('evaluates deeply nested conditions', () => {
        // NOT (A AND NOT B)
        const state = createTestState({
          flags: new Map([['flag_a', true], ['flag_b', true]])
        })
        const condition = not(
          allOf(hasFlag('flag_a'), not(hasFlag('flag_b')))
        )

        const result = resolver.evaluate(condition, state, 'player-1')

        // flag_a exists, flag_b exists, so NOT flag_b is false
        // A AND NOT B = false
        // NOT (A AND NOT B) = true
        expect(result.satisfied).toBe(true)
      })
    })
  })

  describe('isSatisfied helper', () => {
    it('returns boolean directly', () => {
      const state = createTestState({
        flags: new Map([['test_flag', true]])
      })

      expect(resolver.isSatisfied(hasFlag('test_flag'), state, 'player-1')).toBe(true)
      expect(resolver.isSatisfied(hasFlag('missing'), state, 'player-1')).toBe(false)
    })
  })
})
