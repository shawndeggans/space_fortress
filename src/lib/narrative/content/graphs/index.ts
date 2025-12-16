// ============================================================================
// NARRATIVE GRAPHS - Registry
// ============================================================================
//
// Central registry of all narrative graphs.
//
// ============================================================================

import type { NarrativeGraph } from '../../types'
import type { GraphRegistry } from '../../engine'

import { questSalvageClaimGraph } from './quest-salvage-claim'
import { questSanctuaryRunGraph } from './quest-sanctuary-run'
import { questBrokersGambitGraph } from './quest-brokers-gambit'

// ----------------------------------------------------------------------------
// Graph Registry
// ----------------------------------------------------------------------------

/**
 * Registry of all narrative graphs, keyed by graphId.
 */
export const narrativeGraphRegistry: GraphRegistry = new Map([
  [questSalvageClaimGraph.graphId, questSalvageClaimGraph],
  [questSanctuaryRunGraph.graphId, questSanctuaryRunGraph],
  [questBrokersGambitGraph.graphId, questBrokersGambitGraph]
])

// ----------------------------------------------------------------------------
// Individual Graph Exports
// ----------------------------------------------------------------------------

export { questSalvageClaimGraph } from './quest-salvage-claim'
export { questSanctuaryRunGraph } from './quest-sanctuary-run'
export { questBrokersGambitGraph } from './quest-brokers-gambit'

// ----------------------------------------------------------------------------
// Lookup Helpers
// ----------------------------------------------------------------------------

/**
 * Get a graph by its ID.
 */
export function getGraphById(graphId: string): NarrativeGraph | undefined {
  return narrativeGraphRegistry.get(graphId)
}

/**
 * Get all available graph IDs.
 */
export function getAllGraphIds(): string[] {
  return Array.from(narrativeGraphRegistry.keys())
}

/**
 * Check if a graph exists.
 */
export function hasGraph(graphId: string): boolean {
  return narrativeGraphRegistry.has(graphId)
}
