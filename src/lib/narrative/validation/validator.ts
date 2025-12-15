// ============================================================================
// NARRATIVE GRAPH VALIDATOR
// ============================================================================
//
// Comprehensive validation for narrative graphs.
// Detects structural issues, broken links, and potential softlocks.
//
// ============================================================================

import type {
  NarrativeGraph,
  NarrativeNode,
  Transition,
  NodeId,
  NodeType
} from '../types'

// ----------------------------------------------------------------------------
// Validation Types
// ----------------------------------------------------------------------------

export type ValidationSeverity = 'error' | 'warning' | 'info'

export interface ValidationIssue {
  severity: ValidationSeverity
  type: ValidationIssueType
  nodeId?: NodeId
  transitionId?: string
  message: string
}

export type ValidationIssueType =
  | 'broken_link'
  | 'orphan_node'
  | 'dead_end'
  | 'missing_entry'
  | 'duplicate_id'
  | 'missing_choice_text'
  | 'unreachable_ending'
  | 'potential_softlock'
  | 'empty_graph'
  | 'no_endings'
  | 'circular_only'
  | 'missing_content'

export interface ValidationResult {
  valid: boolean
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  info: ValidationIssue[]
  stats: GraphStats
}

export interface GraphStats {
  totalNodes: number
  nodesByType: Record<NodeType, number>
  totalTransitions: number
  entryPoints: number
  endings: number
  maxDepth: number
  avgBranchingFactor: number
}

// ----------------------------------------------------------------------------
// Main Validator
// ----------------------------------------------------------------------------

/**
 * Perform comprehensive validation on a narrative graph.
 */
export function validateGraph(graph: NarrativeGraph): ValidationResult {
  const issues: ValidationIssue[] = []

  // Basic structural checks
  validateStructure(graph, issues)

  // Entry point checks
  validateEntryPoints(graph, issues)

  // Node-level checks
  validateNodes(graph, issues)

  // Transition checks
  validateTransitions(graph, issues)

  // Reachability checks
  validateReachability(graph, issues)

  // Ending checks
  validateEndings(graph, issues)

  // Potential softlock checks
  detectPotentialSoftlocks(graph, issues)

  // Compute stats
  const stats = computeStats(graph)

  // Categorize issues
  const errors = issues.filter(i => i.severity === 'error')
  const warnings = issues.filter(i => i.severity === 'warning')
  const info = issues.filter(i => i.severity === 'info')

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    info,
    stats
  }
}

// ----------------------------------------------------------------------------
// Structural Validation
// ----------------------------------------------------------------------------

function validateStructure(graph: NarrativeGraph, issues: ValidationIssue[]): void {
  // Empty graph check
  if (graph.nodes.size === 0) {
    issues.push({
      severity: 'error',
      type: 'empty_graph',
      message: 'Graph has no nodes'
    })
    return
  }

  // No entry points
  if (graph.entryPoints.length === 0) {
    issues.push({
      severity: 'error',
      type: 'missing_entry',
      message: 'Graph has no entry points'
    })
  }
}

function validateEntryPoints(graph: NarrativeGraph, issues: ValidationIssue[]): void {
  for (const entry of graph.entryPoints) {
    if (!graph.nodes.has(entry.startingNodeId)) {
      issues.push({
        severity: 'error',
        type: 'broken_link',
        nodeId: entry.startingNodeId,
        message: `Entry point "${entry.entryPointId}" references non-existent node: ${entry.startingNodeId}`
      })
    }
  }
}

// ----------------------------------------------------------------------------
// Node Validation
// ----------------------------------------------------------------------------

function validateNodes(graph: NarrativeGraph, issues: ValidationIssue[]): void {
  const nodeIds = new Set<string>()

  Array.from(graph.nodes.entries()).forEach(([nodeId, node]) => {
    // Duplicate ID check
    if (nodeIds.has(nodeId)) {
      issues.push({
        severity: 'error',
        type: 'duplicate_id',
        nodeId,
        message: `Duplicate node ID: ${nodeId}`
      })
    }
    nodeIds.add(nodeId)

    // Missing content check
    if (!node.content.text && !node.content.contentRef) {
      issues.push({
        severity: 'warning',
        type: 'missing_content',
        nodeId,
        message: `Node "${nodeId}" has no text or content reference`
      })
    }

    // Dead end check (non-ending nodes with no transitions)
    if (node.nodeType !== 'ending' && node.transitions.length === 0) {
      issues.push({
        severity: 'error',
        type: 'dead_end',
        nodeId,
        message: `Node "${nodeId}" has no transitions and is not an ending`
      })
    }

    // Choice node without choice text
    if (node.nodeType === 'choice') {
      for (const transition of node.transitions) {
        if (transition.transitionType === 'choice' && !transition.presentation.choiceText) {
          issues.push({
            severity: 'warning',
            type: 'missing_choice_text',
            nodeId,
            transitionId: transition.transitionId,
            message: `Choice transition "${transition.transitionId}" in node "${nodeId}" has no choice text`
          })
        }
      }
    }
  })
}

// ----------------------------------------------------------------------------
// Transition Validation
// ----------------------------------------------------------------------------

function validateTransitions(graph: NarrativeGraph, issues: ValidationIssue[]): void {
  Array.from(graph.nodes.entries()).forEach(([nodeId, node]) => {
    for (const transition of node.transitions) {
      // Broken link check
      if (!graph.nodes.has(transition.targetNodeId)) {
        issues.push({
          severity: 'error',
          type: 'broken_link',
          nodeId,
          transitionId: transition.transitionId,
          message: `Transition "${transition.transitionId}" in node "${nodeId}" targets non-existent node: ${transition.targetNodeId}`
        })
      }
    }
  })
}

// ----------------------------------------------------------------------------
// Reachability Validation
// ----------------------------------------------------------------------------

function validateReachability(graph: NarrativeGraph, issues: ValidationIssue[]): void {
  const reachable = computeReachableNodes(graph)

  Array.from(graph.nodes.keys()).forEach(nodeId => {
    if (!reachable.has(nodeId)) {
      issues.push({
        severity: 'warning',
        type: 'orphan_node',
        nodeId,
        message: `Node "${nodeId}" is not reachable from any entry point`
      })
    }
  })
}

function computeReachableNodes(graph: NarrativeGraph): Set<NodeId> {
  const reachable = new Set<NodeId>()
  const queue: NodeId[] = []

  // Start from all entry points
  for (const entry of graph.entryPoints) {
    if (graph.nodes.has(entry.startingNodeId)) {
      queue.push(entry.startingNodeId)
    }
  }

  // BFS
  while (queue.length > 0) {
    const nodeId = queue.shift()!
    if (reachable.has(nodeId)) continue

    reachable.add(nodeId)

    const node = graph.nodes.get(nodeId)
    if (node) {
      for (const transition of node.transitions) {
        if (!reachable.has(transition.targetNodeId)) {
          queue.push(transition.targetNodeId)
        }
      }
    }
  }

  return reachable
}

// ----------------------------------------------------------------------------
// Ending Validation
// ----------------------------------------------------------------------------

function validateEndings(graph: NarrativeGraph, issues: ValidationIssue[]): void {
  const endings: NodeId[] = []
  const reachable = computeReachableNodes(graph)

  Array.from(graph.nodes.entries()).forEach(([nodeId, node]) => {
    if (node.nodeType === 'ending') {
      endings.push(nodeId)

      if (!reachable.has(nodeId)) {
        issues.push({
          severity: 'warning',
          type: 'unreachable_ending',
          nodeId,
          message: `Ending node "${nodeId}" is not reachable from any entry point`
        })
      }
    }
  })

  if (endings.length === 0) {
    issues.push({
      severity: 'warning',
      type: 'no_endings',
      message: 'Graph has no ending nodes'
    })
  }
}

// ----------------------------------------------------------------------------
// Softlock Detection
// ----------------------------------------------------------------------------

function detectPotentialSoftlocks(graph: NarrativeGraph, issues: ValidationIssue[]): void {
  // A potential softlock is a node that can be entered but has no way out
  // This is more nuanced - we check for nodes where ALL transitions have conditions
  // and those conditions might not all be satisfiable

  Array.from(graph.nodes.entries()).forEach(([nodeId, node]) => {
    if (node.nodeType === 'ending') return
    if (node.transitions.length === 0) return // Already caught as dead_end

    // Check if all transitions have conditions
    const hasUnconditionalExit = node.transitions.some(t => !t.condition)
    const hasFallback = node.transitions.some(t => t.transitionType === 'fallback')

    if (!hasUnconditionalExit && !hasFallback) {
      // All exits are conditional - potential softlock
      issues.push({
        severity: 'info',
        type: 'potential_softlock',
        nodeId,
        message: `Node "${nodeId}" has only conditional transitions - verify all conditions can be satisfied`
      })
    }
  })

  // Check for circular-only paths (no path to ending)
  const canReachEnding = computeNodesReachingEnding(graph)
  const reachable = computeReachableNodes(graph)

  Array.from(graph.nodes.keys()).forEach(nodeId => {
    if (reachable.has(nodeId) && !canReachEnding.has(nodeId)) {
      const node = graph.nodes.get(nodeId)
      if (node && node.nodeType !== 'ending') {
        issues.push({
          severity: 'warning',
          type: 'circular_only',
          nodeId,
          message: `Node "${nodeId}" cannot reach any ending - possible infinite loop`
        })
      }
    }
  })
}

/**
 * Compute nodes that can reach at least one ending (reverse reachability).
 */
function computeNodesReachingEnding(graph: NarrativeGraph): Set<NodeId> {
  const canReach = new Set<NodeId>()

  // Start with all endings
  Array.from(graph.nodes.entries()).forEach(([nodeId, node]) => {
    if (node.nodeType === 'ending') {
      canReach.add(nodeId)
    }
  })

  // Reverse BFS - find nodes that can reach endings
  let changed = true
  while (changed) {
    changed = false
    Array.from(graph.nodes.entries()).forEach(([nodeId, node]) => {
      if (canReach.has(nodeId)) return

      // Check if any transition leads to a node that can reach ending
      for (const transition of node.transitions) {
        if (canReach.has(transition.targetNodeId)) {
          canReach.add(nodeId)
          changed = true
          break
        }
      }
    })
  }

  return canReach
}

// ----------------------------------------------------------------------------
// Statistics
// ----------------------------------------------------------------------------

function computeStats(graph: NarrativeGraph): GraphStats {
  const nodesByType: Record<NodeType, number> = {
    story: 0,
    choice: 0,
    branch: 0,
    hub: 0,
    ending: 0,
    checkpoint: 0
  }

  let totalTransitions = 0
  let endings = 0

  Array.from(graph.nodes.values()).forEach(node => {
    nodesByType[node.nodeType]++
    totalTransitions += node.transitions.length
    if (node.nodeType === 'ending') endings++
  })

  const avgBranchingFactor = graph.nodes.size > 0
    ? totalTransitions / graph.nodes.size
    : 0

  return {
    totalNodes: graph.nodes.size,
    nodesByType,
    totalTransitions,
    entryPoints: graph.entryPoints.length,
    endings,
    maxDepth: computeMaxDepth(graph),
    avgBranchingFactor
  }
}

function computeMaxDepth(graph: NarrativeGraph): number {
  const depths = new Map<NodeId, number>()
  let maxDepth = 0

  // BFS from entry points
  const queue: Array<{ nodeId: NodeId; depth: number }> = []

  for (const entry of graph.entryPoints) {
    if (graph.nodes.has(entry.startingNodeId)) {
      queue.push({ nodeId: entry.startingNodeId, depth: 0 })
    }
  }

  while (queue.length > 0) {
    const { nodeId, depth } = queue.shift()!

    if (depths.has(nodeId)) continue
    depths.set(nodeId, depth)
    maxDepth = Math.max(maxDepth, depth)

    const node = graph.nodes.get(nodeId)
    if (node) {
      for (const transition of node.transitions) {
        if (!depths.has(transition.targetNodeId)) {
          queue.push({ nodeId: transition.targetNodeId, depth: depth + 1 })
        }
      }
    }
  }

  return maxDepth
}
