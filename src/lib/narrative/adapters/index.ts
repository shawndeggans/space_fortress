// ============================================================================
// NARRATIVE ADAPTERS - Public API
// ============================================================================
//
// Re-exports adapter functions for migration support.
//
// ============================================================================

export {
  questToGraph,
  getTransitionIdForChoice,
  getOriginalDilemmaId,
  isQuestEndingNode,
  type AdapterOptions
} from './quest-to-graph-adapter'

export {
  createExternalStateBridge,
  getNarrativeFlags,
  createStateQueries,
  type NarrativeStateQueries
} from './external-state-bridge'
