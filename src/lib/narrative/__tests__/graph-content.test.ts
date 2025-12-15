// ============================================================================
// GRAPH CONTENT - Validation Tests
// ============================================================================
//
// Validates all migrated quest graphs for structural integrity.
//
// ============================================================================

import { describe, it, expect } from 'vitest'
import { validateGraph } from '../validation/validator'
import {
  narrativeGraphRegistry,
  questSalvageClaimGraph,
  questSanctuaryRunGraph,
  questBrokersGambitGraph,
  getAllGraphIds
} from '../content'

// ----------------------------------------------------------------------------
// Graph Registry Tests
// ----------------------------------------------------------------------------

describe('Narrative Graph Registry', () => {
  it('contains all three quests', () => {
    const ids = getAllGraphIds()
    expect(ids).toContain('quest_salvage_claim')
    expect(ids).toContain('quest_sanctuary_run')
    expect(ids).toContain('quest_brokers_gambit')
    expect(ids).toHaveLength(3)
  })

  it('maps graph IDs correctly', () => {
    expect(narrativeGraphRegistry.get('quest_salvage_claim')).toBe(questSalvageClaimGraph)
    expect(narrativeGraphRegistry.get('quest_sanctuary_run')).toBe(questSanctuaryRunGraph)
    expect(narrativeGraphRegistry.get('quest_brokers_gambit')).toBe(questBrokersGambitGraph)
  })
})

// ----------------------------------------------------------------------------
// Quest 1: The Salvage Claim
// ----------------------------------------------------------------------------

describe('Quest 1: The Salvage Claim', () => {
  const graph = questSalvageClaimGraph

  it('passes validation', () => {
    const result = validateGraph(graph)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('has correct metadata', () => {
    expect(graph.graphId).toBe('quest_salvage_claim')
    expect(graph.metadata.title).toBe('The Salvage Claim')
    expect(graph.metadata.tags).toContain('ironveil')
  })

  it('has entry point', () => {
    expect(graph.entryPoints).toHaveLength(1)
    expect(graph.entryPoints[0].startingNodeId).toBe('dilemma_salvage_1_approach')
  })

  it('has all dilemma nodes', () => {
    expect(graph.nodes.has('dilemma_salvage_1_approach')).toBe(true)
    expect(graph.nodes.has('dilemma_salvage_2_discovery')).toBe(true)
    expect(graph.nodes.has('dilemma_salvage_3_confrontation')).toBe(true)
  })

  it('has ending node', () => {
    expect(graph.nodes.has('quest_salvage_claim_ending')).toBe(true)
    const ending = graph.nodes.get('quest_salvage_claim_ending')
    expect(ending?.nodeType).toBe('ending')
  })

  it('has choices with correct transitions', () => {
    const dilemma1 = graph.nodes.get('dilemma_salvage_1_approach')
    expect(dilemma1?.transitions).toHaveLength(3)
    expect(dilemma1?.transitions[0].transitionId).toBe('choice_attack_immediately')
    expect(dilemma1?.transitions[1].transitionId).toBe('choice_hail_first')
    expect(dilemma1?.transitions[2].transitionId).toBe('choice_wait_observe')
  })

  it('has no orphan nodes', () => {
    const result = validateGraph(graph)
    const orphans = result.warnings.filter(w => w.type === 'orphan_node')
    expect(orphans).toHaveLength(0)
  })

  it('has no unreachable endings', () => {
    const result = validateGraph(graph)
    const unreachable = result.warnings.filter(w => w.type === 'unreachable_ending')
    expect(unreachable).toHaveLength(0)
  })
})

// ----------------------------------------------------------------------------
// Quest 2: The Sanctuary Run
// ----------------------------------------------------------------------------

describe('Quest 2: The Sanctuary Run', () => {
  const graph = questSanctuaryRunGraph

  it('passes validation', () => {
    const result = validateGraph(graph)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('has correct metadata', () => {
    expect(graph.graphId).toBe('quest_sanctuary_run')
    expect(graph.metadata.title).toBe('The Sanctuary Run')
    expect(graph.metadata.tags).toContain('ashfall')
  })

  it('has entry point', () => {
    expect(graph.entryPoints).toHaveLength(1)
    expect(graph.entryPoints[0].startingNodeId).toBe('dilemma_sanctuary_1_approach')
  })

  it('has all dilemma nodes', () => {
    expect(graph.nodes.has('dilemma_sanctuary_1_approach')).toBe(true)
    expect(graph.nodes.has('dilemma_sanctuary_2_blockade')).toBe(true)
    expect(graph.nodes.has('dilemma_sanctuary_3_destination')).toBe(true)
  })

  it('has ending node', () => {
    expect(graph.nodes.has('quest_sanctuary_run_ending')).toBe(true)
    const ending = graph.nodes.get('quest_sanctuary_run_ending')
    expect(ending?.nodeType).toBe('ending')
  })

  it('final dilemma has 4 choices', () => {
    const dilemma3 = graph.nodes.get('dilemma_sanctuary_3_destination')
    expect(dilemma3?.transitions).toHaveLength(4)
  })
})

// ----------------------------------------------------------------------------
// Quest 3: The Broker's Gambit
// ----------------------------------------------------------------------------

describe("Quest 3: The Broker's Gambit", () => {
  const graph = questBrokersGambitGraph

  it('passes validation', () => {
    const result = validateGraph(graph)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('has correct metadata', () => {
    expect(graph.graphId).toBe('quest_brokers_gambit')
    expect(graph.metadata.title).toBe("The Broker's Gambit")
    expect(graph.metadata.tags).toContain('meridian')
  })

  it('has entry point', () => {
    expect(graph.entryPoints).toHaveLength(1)
    expect(graph.entryPoints[0].startingNodeId).toBe('dilemma_broker_1_opening')
  })

  it('has all dilemma nodes (4 dilemmas)', () => {
    expect(graph.nodes.has('dilemma_broker_1_opening')).toBe(true)
    expect(graph.nodes.has('dilemma_broker_2_revelation')).toBe(true)
    expect(graph.nodes.has('dilemma_broker_3_choice')).toBe(true)
    expect(graph.nodes.has('dilemma_broker_4_resolution')).toBe(true)
  })

  it('has ending node', () => {
    expect(graph.nodes.has('quest_brokers_gambit_ending')).toBe(true)
    const ending = graph.nodes.get('quest_brokers_gambit_ending')
    expect(ending?.nodeType).toBe('ending')
  })

  it('first dilemma has double-agent option', () => {
    const dilemma1 = graph.nodes.get('dilemma_broker_1_opening')
    const doubleAgent = dilemma1?.transitions.find(t => t.transitionId === 'choice_play_both_sides')
    expect(doubleAgent).toBeDefined()

    // Should set double_agent flag
    const flagEffect = doubleAgent?.effects.find(e => e.target === 'double_agent')
    expect(flagEffect).toBeDefined()
    expect(flagEffect?.value).toBe(true)
  })
})

// ----------------------------------------------------------------------------
// Cross-Graph Validation
// ----------------------------------------------------------------------------

describe('All Graphs Validation', () => {
  const allGraphs = [
    questSalvageClaimGraph,
    questSanctuaryRunGraph,
    questBrokersGambitGraph
  ]

  it('all graphs have unique IDs', () => {
    const ids = allGraphs.map(g => g.graphId)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('all graphs have at least one entry point', () => {
    for (const graph of allGraphs) {
      expect(graph.entryPoints.length).toBeGreaterThan(0)
    }
  })

  it('all graphs have at least one ending', () => {
    for (const graph of allGraphs) {
      const result = validateGraph(graph)
      expect(result.stats.endings).toBeGreaterThan(0)
    }
  })

  it('all graphs pass full validation', () => {
    for (const graph of allGraphs) {
      const result = validateGraph(graph)
      expect(result.valid).toBe(true)
      if (!result.valid) {
        console.error(`Graph ${graph.graphId} failed validation:`, result.errors)
      }
    }
  })

  it('all graphs have voices in choice nodes', () => {
    for (const graph of allGraphs) {
      Array.from(graph.nodes.values()).forEach(node => {
        if (node.nodeType === 'choice') {
          expect(node.content.voices?.length).toBeGreaterThan(0)
        }
      })
    }
  })

  it('no graph has circular-only paths warning', () => {
    for (const graph of allGraphs) {
      const result = validateGraph(graph)
      const circular = result.warnings.filter(w => w.type === 'circular_only')
      expect(circular).toHaveLength(0)
    }
  })
})
