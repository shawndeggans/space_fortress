// ============================================================================
// QUEST TO GRAPH ADAPTER - Tests
// ============================================================================

import { describe, it, expect } from 'vitest'
import { questToGraph } from '../adapters/quest-to-graph-adapter'
import { validateGraph } from '../validation/validator'
import type { Quest, Dilemma } from '../../game/types'

// ----------------------------------------------------------------------------
// Test Data
// ----------------------------------------------------------------------------

const testQuest: Quest = {
  id: 'test_quest',
  faction: 'ironveil',
  title: 'Test Quest',
  briefDescription: 'A test quest for adapter testing',
  fullDescription: 'Full description of the test quest',
  questGiverName: 'Test Giver',
  questGiverDialogue: 'Test dialogue',
  reputationRequired: 0,
  initialBounty: 100,
  initialCards: [],
  dilemmaIds: ['dilemma_1', 'dilemma_2']
}

const testDilemmas: Dilemma[] = [
  {
    id: 'dilemma_1',
    questId: 'test_quest',
    situation: 'First dilemma situation',
    voices: [
      {
        npcName: 'NPC 1',
        faction: 'ironveil',
        dialogue: 'First NPC speaks',
        position: 'Position 1'
      }
    ],
    choices: [
      {
        id: 'choice_1a',
        label: 'First choice',
        description: 'Description of first choice',
        consequences: {
          reputationChanges: [{ faction: 'ironveil', delta: 10 }],
          cardsGained: [],
          cardsLost: [],
          nextDilemmaId: 'dilemma_2',
          flags: { 'chose_first': true }
        }
      },
      {
        id: 'choice_1b',
        label: 'Second choice',
        consequences: {
          reputationChanges: [{ faction: 'ashfall', delta: 5 }],
          cardsGained: ['test_card'],
          cardsLost: [],
          nextDilemmaId: 'dilemma_2'
        }
      }
    ]
  },
  {
    id: 'dilemma_2',
    questId: 'test_quest',
    situation: 'Second dilemma situation',
    voices: [],
    choices: [
      {
        id: 'choice_2a',
        label: 'Final choice',
        consequences: {
          reputationChanges: [],
          cardsGained: [],
          cardsLost: [],
          triggersBattle: {
            opponentType: 'scavengers',
            context: 'Test battle',
            difficulty: 'easy'
          }
        }
      }
    ]
  }
]

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

describe('Quest to Graph Adapter', () => {
  describe('Basic Conversion', () => {
    it('converts quest to graph with correct ID', () => {
      const graph = questToGraph(testQuest, testDilemmas)

      expect(graph.graphId).toBe('test_quest')
      expect(graph.version).toBe('1.0.0')
    })

    it('creates entry point from first dilemma', () => {
      const graph = questToGraph(testQuest, testDilemmas)

      expect(graph.entryPoints).toHaveLength(1)
      expect(graph.entryPoints[0].startingNodeId).toBe('dilemma_1')
    })

    it('creates nodes for all dilemmas', () => {
      const graph = questToGraph(testQuest, testDilemmas)

      expect(graph.nodes.has('dilemma_1')).toBe(true)
      expect(graph.nodes.has('dilemma_2')).toBe(true)
    })

    it('creates ending node', () => {
      const graph = questToGraph(testQuest, testDilemmas)

      expect(graph.nodes.has('test_quest_ending')).toBe(true)
      const ending = graph.nodes.get('test_quest_ending')
      expect(ending?.nodeType).toBe('ending')
    })
  })

  describe('Node Content', () => {
    it('preserves dilemma situation text', () => {
      const graph = questToGraph(testQuest, testDilemmas)
      const node = graph.nodes.get('dilemma_1')

      expect(node?.content.text).toBe('First dilemma situation')
    })

    it('preserves voices as content', () => {
      const graph = questToGraph(testQuest, testDilemmas)
      const node = graph.nodes.get('dilemma_1')

      expect(node?.content.voices).toHaveLength(1)
      expect(node?.content.voices?.[0].npcName).toBe('NPC 1')
      expect(node?.content.voices?.[0].dialogue).toBe('First NPC speaks')
    })
  })

  describe('Transitions', () => {
    it('creates transitions for choices', () => {
      const graph = questToGraph(testQuest, testDilemmas)
      const node = graph.nodes.get('dilemma_1')

      expect(node?.transitions).toHaveLength(2)
    })

    it('sets correct target node from nextDilemmaId', () => {
      const graph = questToGraph(testQuest, testDilemmas)
      const node = graph.nodes.get('dilemma_1')
      const transition = node?.transitions[0]

      expect(transition?.targetNodeId).toBe('dilemma_2')
    })

    it('preserves choice labels', () => {
      const graph = questToGraph(testQuest, testDilemmas)
      const node = graph.nodes.get('dilemma_1')
      const transition = node?.transitions[0]

      expect(transition?.presentation.choiceText).toBe('First choice')
    })

    it('creates effects from consequences', () => {
      const graph = questToGraph(testQuest, testDilemmas)
      const node = graph.nodes.get('dilemma_1')
      const transition = node?.transitions[0]

      // Should have reputation effect and flag effect
      const repEffect = transition?.effects.find(e => e.target === 'reputation_ironveil')
      expect(repEffect).toBeDefined()
      expect(repEffect?.effectType).toBe('increment')
      expect(repEffect?.value).toBe(10)

      const flagEffect = transition?.effects.find(e => e.target === 'chose_first')
      expect(flagEffect).toBeDefined()
      expect(flagEffect?.effectType).toBe('set_flag')
    })

    it('targets ending for final dilemma choices without nextDilemmaId', () => {
      const graph = questToGraph(testQuest, testDilemmas)
      const node = graph.nodes.get('dilemma_2')
      const transition = node?.transitions[0]

      // Choice triggers battle but has no nextDilemmaId, so should go to ending
      expect(transition?.targetNodeId).toBe('test_quest_ending')
    })
  })

  describe('Consequence Levels', () => {
    it('marks major consequences correctly', () => {
      const graph = questToGraph(testQuest, testDilemmas)
      const node = graph.nodes.get('dilemma_2')
      const transition = node?.transitions[0]

      // Battle trigger should be marked as major
      expect(transition?.presentation.consequenceLevel).toBe('major')
    })

    it('marks minor consequences correctly', () => {
      // Create a quest with minor consequences only
      const minorQuest: Quest = { ...testQuest, dilemmaIds: ['minor_dilemma'] }
      const minorDilemmas: Dilemma[] = [{
        id: 'minor_dilemma',
        questId: 'test_quest',
        situation: 'Minor choice',
        voices: [],
        choices: [{
          id: 'minor_choice',
          label: 'Small choice',
          consequences: {
            reputationChanges: [{ faction: 'ironveil', delta: 5 }],
            cardsGained: [],
            cardsLost: []
          }
        }]
      }]

      const graph = questToGraph(minorQuest, minorDilemmas)
      const node = graph.nodes.get('minor_dilemma')
      const transition = node?.transitions[0]

      expect(transition?.presentation.consequenceLevel).toBe('minor')
    })
  })

  describe('Graph Validation', () => {
    it('produces a valid graph', () => {
      const graph = questToGraph(testQuest, testDilemmas)
      const result = validateGraph(graph)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('has no orphan nodes', () => {
      const graph = questToGraph(testQuest, testDilemmas)
      const result = validateGraph(graph)

      expect(result.warnings.filter(w => w.type === 'orphan_node')).toHaveLength(0)
    })

    it('has reachable ending', () => {
      const graph = questToGraph(testQuest, testDilemmas)
      const result = validateGraph(graph)

      expect(result.warnings.filter(w => w.type === 'unreachable_ending')).toHaveLength(0)
    })
  })

  describe('Metadata', () => {
    it('includes quest title in metadata', () => {
      const graph = questToGraph(testQuest, testDilemmas)

      expect(graph.metadata.title).toBe('Test Quest')
    })

    it('tags graph with faction', () => {
      const graph = questToGraph(testQuest, testDilemmas)

      expect(graph.metadata.tags).toContain('ironveil')
    })
  })
})
