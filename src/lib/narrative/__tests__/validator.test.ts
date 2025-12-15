// ============================================================================
// GRAPH VALIDATOR - Tests
// ============================================================================

import { describe, it, expect } from 'vitest'
import { validateGraph } from '../validation/validator'
import type { NarrativeGraph, NarrativeNode, Transition } from '../types'

// ----------------------------------------------------------------------------
// Test Helpers
// ----------------------------------------------------------------------------

function createTestNode(
  nodeId: string,
  nodeType: NarrativeNode['nodeType'] = 'choice',
  transitions: Transition[] = []
): NarrativeNode {
  return {
    nodeId,
    nodeType,
    content: {
      contentType: 'inline',
      text: `Content for ${nodeId}`
    },
    transitions,
    metadata: {
      isRevisitable: true,
      requiresFlags: [],
      setsFlags: []
    }
  }
}

function createTransition(
  transitionId: string,
  targetNodeId: string,
  transitionType: Transition['transitionType'] = 'choice'
): Transition {
  return {
    transitionId,
    targetNodeId,
    transitionType,
    presentation: {
      choiceText: `Go to ${targetNodeId}`,
      isHidden: false,
      isDisabled: false
    },
    effects: []
  }
}

function createTestGraph(
  nodes: NarrativeNode[],
  entryNodeId?: string
): NarrativeGraph {
  const nodeMap = new Map<string, NarrativeNode>()
  for (const node of nodes) {
    nodeMap.set(node.nodeId, node)
  }

  return {
    graphId: 'test-graph',
    version: '1.0.0',
    metadata: {
      title: 'Test Graph',
      totalNodeCount: nodes.length,
      tags: []
    },
    entryPoints: entryNodeId ? [{
      entryPointId: 'main',
      startingNodeId: entryNodeId
    }] : [],
    nodes: nodeMap,
    globalConditions: new Map()
  }
}

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

describe('Graph Validator', () => {
  describe('Structural Validation', () => {
    it('reports error for empty graph', () => {
      const graph = createTestGraph([])

      const result = validateGraph(graph)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({ type: 'empty_graph' })
      )
    })

    it('reports error for missing entry points', () => {
      const graph = createTestGraph([
        createTestNode('node-1', 'ending')
      ])

      const result = validateGraph(graph)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({ type: 'missing_entry' })
      )
    })

    it('validates simple valid graph', () => {
      const graph = createTestGraph([
        createTestNode('start', 'choice', [
          createTransition('t1', 'end')
        ]),
        createTestNode('end', 'ending')
      ], 'start')

      const result = validateGraph(graph)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('Link Validation', () => {
    it('reports broken links', () => {
      const graph = createTestGraph([
        createTestNode('start', 'choice', [
          createTransition('t1', 'nonexistent-node')
        ])
      ], 'start')

      const result = validateGraph(graph)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'broken_link',
          nodeId: 'start'
        })
      )
    })

    it('reports entry point broken links', () => {
      const graph = createTestGraph([
        createTestNode('node-1', 'ending')
      ], 'nonexistent-start')

      const result = validateGraph(graph)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'broken_link',
          nodeId: 'nonexistent-start'
        })
      )
    })
  })

  describe('Dead End Detection', () => {
    it('reports dead ends (non-ending nodes with no transitions)', () => {
      const graph = createTestGraph([
        createTestNode('start', 'choice', [
          createTransition('t1', 'dead-end')
        ]),
        createTestNode('dead-end', 'choice', []) // No transitions, not an ending
      ], 'start')

      const result = validateGraph(graph)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'dead_end',
          nodeId: 'dead-end'
        })
      )
    })

    it('does not report endings as dead ends', () => {
      const graph = createTestGraph([
        createTestNode('start', 'choice', [
          createTransition('t1', 'end')
        ]),
        createTestNode('end', 'ending', []) // Endings can have no transitions
      ], 'start')

      const result = validateGraph(graph)

      expect(result.valid).toBe(true)
      expect(result.errors.filter(e => e.type === 'dead_end')).toHaveLength(0)
    })
  })

  describe('Orphan Detection', () => {
    it('reports orphaned nodes', () => {
      const graph = createTestGraph([
        createTestNode('start', 'choice', [
          createTransition('t1', 'connected')
        ]),
        createTestNode('connected', 'ending'),
        createTestNode('orphan', 'ending') // Not reachable from entry
      ], 'start')

      const result = validateGraph(graph)

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'orphan_node',
          nodeId: 'orphan'
        })
      )
    })
  })

  describe('Ending Validation', () => {
    it('warns when no endings exist', () => {
      // Create a circular graph with no endings
      const graph = createTestGraph([
        createTestNode('node-a', 'choice', [
          createTransition('t1', 'node-b')
        ]),
        createTestNode('node-b', 'choice', [
          createTransition('t2', 'node-a')
        ])
      ], 'node-a')

      const result = validateGraph(graph)

      expect(result.warnings).toContainEqual(
        expect.objectContaining({ type: 'no_endings' })
      )
    })

    it('warns about unreachable endings', () => {
      const graph = createTestGraph([
        createTestNode('start', 'choice', [
          createTransition('t1', 'end-1')
        ]),
        createTestNode('end-1', 'ending'),
        createTestNode('end-2', 'ending') // Unreachable
      ], 'start')

      const result = validateGraph(graph)

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'unreachable_ending',
          nodeId: 'end-2'
        })
      )
    })
  })

  describe('Softlock Detection', () => {
    it('warns about nodes that cannot reach any ending', () => {
      // Create a loop that can't escape to an ending
      const graph = createTestGraph([
        createTestNode('start', 'choice', [
          createTransition('t1', 'loop-a')
        ]),
        createTestNode('loop-a', 'choice', [
          createTransition('t2', 'loop-b')
        ]),
        createTestNode('loop-b', 'choice', [
          createTransition('t3', 'loop-a')
        ]),
        createTestNode('unreachable-end', 'ending')
      ], 'start')

      const result = validateGraph(graph)

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'circular_only'
        })
      )
    })
  })

  describe('Statistics', () => {
    it('computes correct stats', () => {
      const graph = createTestGraph([
        createTestNode('start', 'choice', [
          createTransition('t1', 'mid-1'),
          createTransition('t2', 'mid-2')
        ]),
        createTestNode('mid-1', 'story', [
          createTransition('t3', 'end')
        ]),
        createTestNode('mid-2', 'branch', [
          createTransition('t4', 'end')
        ]),
        createTestNode('end', 'ending')
      ], 'start')

      const result = validateGraph(graph)

      expect(result.stats.totalNodes).toBe(4)
      expect(result.stats.nodesByType.choice).toBe(1)
      expect(result.stats.nodesByType.story).toBe(1)
      expect(result.stats.nodesByType.branch).toBe(1)
      expect(result.stats.nodesByType.ending).toBe(1)
      expect(result.stats.totalTransitions).toBe(4)
      expect(result.stats.entryPoints).toBe(1)
      expect(result.stats.endings).toBe(1)
      expect(result.stats.avgBranchingFactor).toBe(1) // 4 transitions / 4 nodes
    })
  })
})
