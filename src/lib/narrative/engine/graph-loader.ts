// ============================================================================
// GRAPH LOADER
// ============================================================================
//
// Loads and caches narrative graphs.
// Validates graphs on load to catch errors early.
//
// ============================================================================

import type {
  NarrativeGraph,
  NarrativeNode,
  NodeId
} from '../types'

// ----------------------------------------------------------------------------
// Loader Interface
// ----------------------------------------------------------------------------

export interface GraphLoader {
  /**
   * Load a graph by ID.
   */
  loadGraph(graphId: string): NarrativeGraph | null

  /**
   * Get a node from a loaded graph.
   */
  getNode(graphId: string, nodeId: NodeId): NarrativeNode | null

  /**
   * Check if a graph is loaded.
   */
  isLoaded(graphId: string): boolean

  /**
   * Clear the cache.
   */
  clearCache(): void

  /**
   * Get all loaded graph IDs.
   */
  getLoadedGraphIds(): string[]
}

// ----------------------------------------------------------------------------
// Graph Registry
// ----------------------------------------------------------------------------

export type GraphRegistry = Map<string, NarrativeGraph>

/**
 * Create a graph loader with a registry of graphs.
 */
export function createGraphLoader(registry: GraphRegistry): GraphLoader {
  const cache = new Map<string, NarrativeGraph>()

  return {
    loadGraph(graphId: string): NarrativeGraph | null {
      // Check cache first
      const cached = cache.get(graphId)
      if (cached) return cached

      // Load from registry
      const graph = registry.get(graphId)
      if (!graph) {
        console.warn(`Graph not found: ${graphId}`)
        return null
      }

      // Validate on load
      const errors = validateGraphStructure(graph)
      if (errors.length > 0) {
        console.error(`Graph validation failed for ${graphId}:`, errors)
        // Still load but warn - allows development to continue
      }

      // Cache and return
      cache.set(graphId, graph)
      return graph
    },

    getNode(graphId: string, nodeId: NodeId): NarrativeNode | null {
      const graph = this.loadGraph(graphId)
      if (!graph) return null
      return graph.nodes.get(nodeId) ?? null
    },

    isLoaded(graphId: string): boolean {
      return cache.has(graphId)
    },

    clearCache(): void {
      cache.clear()
    },

    getLoadedGraphIds(): string[] {
      return Array.from(cache.keys())
    }
  }
}

// ----------------------------------------------------------------------------
// Basic Validation
// ----------------------------------------------------------------------------

export interface ValidationError {
  type: 'broken_link' | 'orphan' | 'dead_end' | 'missing_entry' | 'duplicate_id'
  nodeId?: NodeId
  message: string
}

/**
 * Perform basic structural validation on a graph.
 */
export function validateGraphStructure(graph: NarrativeGraph): ValidationError[] {
  const errors: ValidationError[] = []

  // Check entry points exist
  for (const entry of graph.entryPoints) {
    if (!graph.nodes.has(entry.startingNodeId)) {
      errors.push({
        type: 'missing_entry',
        nodeId: entry.startingNodeId,
        message: `Entry point "${entry.entryPointId}" references non-existent node: ${entry.startingNodeId}`
      })
    }
  }

  // Check all transitions point to existing nodes
  Array.from(graph.nodes.entries()).forEach(([nodeId, node]) => {
    for (const transition of node.transitions) {
      if (!graph.nodes.has(transition.targetNodeId)) {
        errors.push({
          type: 'broken_link',
          nodeId,
          message: `Node "${nodeId}" has transition to non-existent node: ${transition.targetNodeId}`
        })
      }
    }

    // Check for dead ends (non-ending nodes with no transitions)
    if (node.nodeType !== 'ending' && node.transitions.length === 0) {
      errors.push({
        type: 'dead_end',
        nodeId,
        message: `Node "${nodeId}" has no transitions and is not an ending`
      })
    }
  })

  // Check for orphaned nodes (not reachable from any entry)
  const reachable = computeReachableNodes(graph)
  Array.from(graph.nodes.keys()).forEach(nodeId => {
    if (!reachable.has(nodeId)) {
      errors.push({
        type: 'orphan',
        nodeId,
        message: `Node "${nodeId}" is not reachable from any entry point`
      })
    }
  })

  return errors
}

/**
 * Compute the set of nodes reachable from entry points.
 */
function computeReachableNodes(graph: NarrativeGraph): Set<NodeId> {
  const reachable = new Set<NodeId>()
  const queue: NodeId[] = []

  // Start from all entry points
  for (const entry of graph.entryPoints) {
    queue.push(entry.startingNodeId)
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
// Graph Builder
// ----------------------------------------------------------------------------

export interface GraphBuilder {
  setMetadata(title: string, author?: string): GraphBuilder
  addEntryPoint(id: string, startNodeId: NodeId, description?: string): GraphBuilder
  addNode(node: NarrativeNode): GraphBuilder
  build(): NarrativeGraph
}

/**
 * Create a builder for constructing graphs programmatically.
 */
export function createGraphBuilder(graphId: string, version: string = '1.0.0'): GraphBuilder {
  const nodes = new Map<NodeId, NarrativeNode>()
  const entryPoints: NarrativeGraph['entryPoints'] = []
  let title = graphId
  let author: string | undefined

  return {
    setMetadata(newTitle: string, newAuthor?: string): GraphBuilder {
      title = newTitle
      author = newAuthor
      return this
    },

    addEntryPoint(id: string, startNodeId: NodeId, description?: string): GraphBuilder {
      entryPoints.push({
        entryPointId: id,
        startingNodeId: startNodeId,
        description
      })
      return this
    },

    addNode(node: NarrativeNode): GraphBuilder {
      nodes.set(node.nodeId, node)
      return this
    },

    build(): NarrativeGraph {
      return {
        graphId,
        version,
        metadata: {
          title,
          author,
          totalNodeCount: nodes.size,
          tags: []
        },
        entryPoints,
        nodes,
        globalConditions: new Map()
      }
    }
  }
}
