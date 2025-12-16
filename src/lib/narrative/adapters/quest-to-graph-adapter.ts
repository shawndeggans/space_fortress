// ============================================================================
// QUEST TO GRAPH ADAPTER
// ============================================================================
//
// Converts existing Quest/Dilemma content to NarrativeGraph format.
// Enables gradual migration while maintaining backward compatibility.
//
// ============================================================================

import type { Quest, Dilemma, Choice, Voice } from '../../game/types'
import type {
  NarrativeGraph,
  NarrativeNode,
  Transition,
  NodeContent,
  VoiceContent,
  TransitionPresentation,
  TransitionEffect,
  NodeType,
  TransitionType,
  NodeId,
  TransitionId
} from '../types'

// ----------------------------------------------------------------------------
// Adapter Options
// ----------------------------------------------------------------------------

export interface AdapterOptions {
  /** Include original IDs in metadata for debugging */
  preserveOriginalIds?: boolean
  /** Generate hub node for quest start */
  createQuestHub?: boolean
  /** Generate ending nodes after final dilemma */
  createEndingNodes?: boolean
}

const defaultOptions: AdapterOptions = {
  preserveOriginalIds: true,
  createQuestHub: false,
  createEndingNodes: true
}

// ----------------------------------------------------------------------------
// Main Adapter Function
// ----------------------------------------------------------------------------

/**
 * Convert a Quest and its Dilemmas to a NarrativeGraph.
 */
export function questToGraph(
  quest: Quest,
  dilemmas: Dilemma[],
  options: AdapterOptions = {}
): NarrativeGraph {
  const opts = { ...defaultOptions, ...options }
  const nodes = new Map<NodeId, NarrativeNode>()

  // Create node for each dilemma
  for (const dilemma of dilemmas) {
    const node = dilemmaToNode(dilemma, quest, opts)
    nodes.set(node.nodeId, node)
  }

  // Create ending nodes if option enabled
  if (opts.createEndingNodes) {
    const endingNode = createQuestEndingNode(quest)
    nodes.set(endingNode.nodeId, endingNode)
  }

  // Build the graph
  const graph: NarrativeGraph = {
    graphId: quest.id,
    version: '1.0.0',
    metadata: {
      title: quest.title,
      author: 'Migrated from Quest',
      totalNodeCount: nodes.size,
      estimatedPlaythroughMinutes: dilemmas.length * 5,
      tags: [quest.faction, 'quest', 'migrated']
    },
    entryPoints: [
      {
        entryPointId: `${quest.id}_start`,
        startingNodeId: quest.dilemmaIds[0],
        description: quest.briefDescription
      }
    ],
    nodes,
    globalConditions: new Map()
  }

  return graph
}

// ----------------------------------------------------------------------------
// Node Conversion
// ----------------------------------------------------------------------------

/**
 * Convert a Dilemma to a NarrativeNode.
 */
function dilemmaToNode(
  dilemma: Dilemma,
  quest: Quest,
  options: AdapterOptions
): NarrativeNode {
  const nodeType: NodeType = 'choice'

  // Convert voices to content
  const voices: VoiceContent[] = dilemma.voices.map(voiceToContent)

  const content: NodeContent = {
    contentType: 'inline',
    text: dilemma.situation,
    voices
  }

  // Convert choices to transitions
  const transitions: Transition[] = dilemma.choices.map((choice, index) =>
    choiceToTransition(choice, index, dilemma, quest)
  )

  const node: NarrativeNode = {
    nodeId: dilemma.id,
    nodeType,
    content,
    transitions,
    metadata: {
      isRevisitable: false,
      requiresFlags: [],
      setsFlags: [],
      analytics: {
        trackVisits: true,
        trackTime: true
      }
    }
  }

  return node
}

/**
 * Convert a Voice to VoiceContent.
 */
function voiceToContent(voice: Voice): VoiceContent {
  return {
    npcName: voice.npcName,
    factionId: voice.faction === 'crew' || voice.faction === 'other'
      ? voice.faction
      : voice.faction,
    dialogue: voice.dialogue,
    position: voice.position
  }
}

/**
 * Convert a Choice to a Transition.
 */
function choiceToTransition(
  choice: Choice,
  index: number,
  dilemma: Dilemma,
  quest: Quest
): Transition {
  const transitionId: TransitionId = `${dilemma.id}_choice_${index}`
  const transitionType: TransitionType = 'choice'

  // Determine target node
  let targetNodeId: NodeId
  if (choice.consequences.nextDilemmaId) {
    targetNodeId = choice.consequences.nextDilemmaId
  } else if (choice.consequences.triggersBattle) {
    // After battle, continue to next dilemma or ending
    const currentIndex = quest.dilemmaIds.indexOf(dilemma.id)
    if (currentIndex < quest.dilemmaIds.length - 1) {
      targetNodeId = quest.dilemmaIds[currentIndex + 1]
    } else {
      targetNodeId = `${quest.id}_ending`
    }
  } else if (choice.consequences.triggersAlliance || choice.consequences.triggersMediation) {
    // Alliance/mediation flows back to current or next dilemma
    const currentIndex = quest.dilemmaIds.indexOf(dilemma.id)
    if (currentIndex < quest.dilemmaIds.length - 1) {
      targetNodeId = quest.dilemmaIds[currentIndex + 1]
    } else {
      targetNodeId = `${quest.id}_ending`
    }
  } else {
    // Default: quest ending
    targetNodeId = `${quest.id}_ending`
  }

  // Build presentation
  const presentation: TransitionPresentation = {
    choiceText: choice.label,
    shortLabel: choice.label.slice(0, 20),
    isHidden: false,
    isDisabled: false,
    previewHint: choice.description,
    consequenceLevel: determineConsequenceLevel(choice)
  }

  // Build effects
  const effects: TransitionEffect[] = buildTransitionEffects(choice)

  const transition: Transition = {
    transitionId,
    targetNodeId,
    transitionType,
    presentation,
    effects
  }

  return transition
}

/**
 * Determine the consequence level based on choice effects.
 */
function determineConsequenceLevel(choice: Choice): 'minor' | 'major' | 'irreversible' {
  const cons = choice.consequences

  // Major reputation swings
  const hasLargeRepChange = cons.reputationChanges.some(r => Math.abs(r.delta) >= 20)
  if (hasLargeRepChange) return 'major'

  // Losing cards is significant
  if (cons.cardsLost.length > 0) return 'major'

  // Battle triggers are major
  if (cons.triggersBattle) return 'major'

  // Alliance triggers are significant
  if (cons.triggersAlliance) return 'major'

  // Risk outcomes
  if (cons.risk && cons.risk.probability > 0.3) return 'major'

  return 'minor'
}

/**
 * Build transition effects from choice consequences.
 */
function buildTransitionEffects(choice: Choice): TransitionEffect[] {
  const effects: TransitionEffect[] = []
  const cons = choice.consequences

  // Reputation changes
  for (const rep of cons.reputationChanges) {
    effects.push({
      effectType: rep.delta >= 0 ? 'increment' : 'decrement',
      target: `reputation_${rep.faction}`,
      value: Math.abs(rep.delta)
    })
  }

  // Cards gained
  for (const cardId of cons.cardsGained) {
    effects.push({
      effectType: 'trigger_event',
      target: 'CARD_GAINED',
      value: { cardId, source: 'choice' }
    })
  }

  // Cards lost
  for (const cardId of cons.cardsLost) {
    effects.push({
      effectType: 'trigger_event',
      target: 'CARD_LOST',
      value: { cardId, reason: 'choice' }
    })
  }

  // Bounty modifier
  if (cons.bountyModifier) {
    effects.push({
      effectType: cons.bountyModifier >= 0 ? 'increment' : 'decrement',
      target: 'bounty',
      value: Math.abs(cons.bountyModifier)
    })
  }

  // Flags
  if (cons.flags) {
    for (const [flag, value] of Object.entries(cons.flags)) {
      effects.push({
        effectType: 'set_flag',
        target: flag,
        value
      })
    }
  }

  // Battle trigger
  if (cons.triggersBattle) {
    effects.push({
      effectType: 'trigger_event',
      target: 'BATTLE_TRIGGERED',
      value: cons.triggersBattle
    })
  }

  // Alliance trigger
  if (cons.triggersAlliance) {
    effects.push({
      effectType: 'set_flag',
      target: 'triggers_alliance',
      value: true
    })
  }

  // Mediation trigger
  if (cons.triggersMediation) {
    effects.push({
      effectType: 'set_flag',
      target: 'triggers_mediation',
      value: true
    })
  }

  return effects
}

// ----------------------------------------------------------------------------
// Helper Nodes
// ----------------------------------------------------------------------------

/**
 * Create an ending node for a quest.
 */
function createQuestEndingNode(quest: Quest): NarrativeNode {
  return {
    nodeId: `${quest.id}_ending`,
    nodeType: 'ending',
    content: {
      contentType: 'inline',
      text: `You have completed "${quest.title}". Your choices will have lasting consequences across the sector.`
    },
    transitions: [],
    metadata: {
      isRevisitable: false,
      requiresFlags: [],
      setsFlags: [`quest_${quest.id}_completed`],
      analytics: {
        trackVisits: true,
        trackTime: false
      }
    }
  }
}

// ----------------------------------------------------------------------------
// Utility Functions
// ----------------------------------------------------------------------------

/**
 * Get the transition ID for a specific choice in a dilemma.
 */
export function getTransitionIdForChoice(dilemmaId: string, choiceIndex: number): TransitionId {
  return `${dilemmaId}_choice_${choiceIndex}`
}

/**
 * Extract the original dilemma ID from a node ID.
 */
export function getOriginalDilemmaId(nodeId: NodeId): string {
  return nodeId
}

/**
 * Check if a node ID represents a quest ending.
 */
export function isQuestEndingNode(nodeId: NodeId): boolean {
  return nodeId.endsWith('_ending')
}
