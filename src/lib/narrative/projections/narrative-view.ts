// ============================================================================
// NARRATIVE VIEW PROJECTION
// ============================================================================
//
// Projects narrative state from game events using the narrative graph system.
// Can be used alongside or as replacement for legacy dilemmaView projection.
//
// ============================================================================

import type { GameState, FactionId } from '../../game/types'
import type { GameEvent } from '../../game/events'
import { rebuildState } from '../../game/projections'
import { getGraphById } from '../content'
import type {
  NarrativeGraph,
  NarrativeNode,
  Transition,
  ResolvedChoice,
  ResolvedNodeContent,
  ResolvedVoice
} from '../types'

// ----------------------------------------------------------------------------
// View Types
// ----------------------------------------------------------------------------

export interface NarrativeViewData {
  // Current position
  nodeId: string
  questId: string
  questTitle: string

  // Content
  situation: string
  voices: NarrativeVoiceData[]

  // Choices
  choices: NarrativeChoiceData[]

  // Context
  isPostBattle: boolean
  battleContext?: string
  dilemmaIndex: number
  totalDilemmas: number
}

export interface NarrativeVoiceData {
  npcName: string
  factionId: string
  factionIcon: string
  factionColor: string
  dialogue: string
  position?: string
}

export interface NarrativeChoiceData {
  choiceId: string
  transitionId: string
  label: string
  description?: string

  // Consequence previews (derived from effects)
  reputationPreviews: ReputationPreviewData[]
  cardsGained: string[]
  cardsLost: string[]
  bountyModifier: number

  // Triggers
  triggersBattle: boolean
  triggersAlliance: boolean
  triggersMediation: boolean

  // Consequence hints from presentation
  consequenceHint?: string
  consequenceLevel?: 'minor' | 'major' | 'irreversible'

  // Card economy
  cardImpact: CardImpactData
}

export interface ReputationPreviewData {
  factionId: FactionId
  factionIcon: string
  factionColor: string
  delta: number
  isPositive: boolean
}

export interface CardImpactData {
  currentCardCount: number
  gains: number
  losses: number
  netChange: number
  resultingTotal: number
  wouldCauseShortage: boolean
  warningMessage: string | null
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const FACTION_ICONS: Record<string, string> = {
  ironveil: '▣',
  ashfall: '◈',
  meridian: '⬡',
  void_wardens: '⛊',
  sundered_oath: '✕',
  crew: '○',
  other: '○'
}

const FACTION_COLORS: Record<string, string> = {
  ironveil: '#c9a227',
  ashfall: '#e85d04',
  meridian: '#00b4d8',
  void_wardens: '#7209b7',
  sundered_oath: '#6c757d',
  crew: '#888888',
  other: '#888888'
}

const MIN_BATTLE_CARDS = 5

// ----------------------------------------------------------------------------
// Main Projection
// ----------------------------------------------------------------------------

/**
 * Project narrative view from game state using narrative graphs.
 */
export function projectNarrativeView(
  events: GameEvent[],
  providedState?: GameState
): NarrativeViewData | null {
  const state = providedState ?? rebuildState(events)

  // Get current dilemma/node ID
  const nodeId = state.currentDilemmaId
  if (!nodeId) return null

  // Get quest ID
  const questId = state.activeQuest?.questId
  if (!questId) return null

  // Try to get graph for this quest
  const graph = getGraphById(questId)
  if (!graph) {
    // Fall back - graph not found
    return null
  }

  // Get node from graph
  const node = graph.nodes.get(nodeId)
  if (!node) {
    // Node not found in graph
    return null
  }

  return buildViewFromNode(node, graph, state)
}

/**
 * Project narrative view directly from a graph and node ID.
 */
export function projectNarrativeViewFromGraph(
  graph: NarrativeGraph,
  nodeId: string,
  state: GameState
): NarrativeViewData | null {
  const node = graph.nodes.get(nodeId)
  if (!node) return null

  return buildViewFromNode(node, graph, state)
}

// ----------------------------------------------------------------------------
// View Building
// ----------------------------------------------------------------------------

function buildViewFromNode(
  node: NarrativeNode,
  graph: NarrativeGraph,
  state: GameState
): NarrativeViewData {
  // Build voices
  const voices: NarrativeVoiceData[] = (node.content.voices || []).map(v => ({
    npcName: v.npcName,
    factionId: v.factionId,
    factionIcon: FACTION_ICONS[v.factionId] || '○',
    factionColor: FACTION_COLORS[v.factionId] || '#888888',
    dialogue: v.dialogue,
    position: v.position
  }))

  // Current card count for impact calculation
  const currentCardCount = state.ownedCards.length

  // Check if battle is upcoming
  const battleUpcoming = node.transitions.some(t =>
    t.effects.some(e => e.target === 'BATTLE_TRIGGERED' || e.target === 'triggers_alliance')
  )

  // Build choices from transitions
  const choices: NarrativeChoiceData[] = node.transitions
    .filter(t => t.transitionType === 'choice')
    .map(t => buildChoiceFromTransition(t, currentCardCount, battleUpcoming))

  // Determine dilemma index (use graph nodes count since totalDilemmas isn't tracked on ActiveQuest)
  const dilemmaIndex = state.activeQuest?.currentDilemmaIndex ?? 0
  const totalDilemmas = graph.nodes.size - 1 // -1 for ending node

  // Post-battle check
  const isPostBattle = node.nodeId.includes('post_battle') || state.currentPhase === 'post_battle_dilemma'

  return {
    nodeId: node.nodeId,
    questId: graph.graphId,
    questTitle: graph.metadata.title,
    situation: node.content.text || '',
    voices,
    choices,
    isPostBattle,
    battleContext: isPostBattle ? state.currentBattle?.battleId : undefined,
    dilemmaIndex,
    totalDilemmas
  }
}

function buildChoiceFromTransition(
  transition: Transition,
  currentCardCount: number,
  battleUpcoming: boolean
): NarrativeChoiceData {
  // Parse effects to build previews
  const reputationPreviews: ReputationPreviewData[] = []
  const cardsGained: string[] = []
  const cardsLost: string[] = []
  let bountyModifier = 0
  let triggersBattle = false
  let triggersAlliance = false
  let triggersMediation = false

  for (const effect of transition.effects) {
    // Reputation changes
    if (effect.target.startsWith('reputation_')) {
      const factionId = effect.target.replace('reputation_', '') as FactionId
      const delta = effect.effectType === 'increment'
        ? (effect.value as number)
        : -(effect.value as number)

      reputationPreviews.push({
        factionId,
        factionIcon: FACTION_ICONS[factionId] || '○',
        factionColor: FACTION_COLORS[factionId] || '#888888',
        delta,
        isPositive: delta > 0
      })
    }

    // Card changes
    if (effect.target === 'CARD_GAINED') {
      const cardData = effect.value as { cardId: string }
      cardsGained.push(cardData.cardId)
    }
    if (effect.target === 'CARD_LOST') {
      const cardData = effect.value as { cardId: string }
      cardsLost.push(cardData.cardId)
    }

    // Bounty
    if (effect.target === 'bounty') {
      bountyModifier = effect.effectType === 'increment'
        ? (effect.value as number)
        : -(effect.value as number)
    }

    // Triggers
    if (effect.target === 'BATTLE_TRIGGERED') {
      triggersBattle = true
    }
    if (effect.target === 'triggers_alliance') {
      triggersAlliance = true
    }
    if (effect.target === 'triggers_mediation') {
      triggersMediation = true
    }
  }

  // Calculate card impact
  const gains = cardsGained.length
  const losses = cardsLost.length
  const netChange = gains - losses
  const resultingTotal = currentCardCount + netChange
  const wouldCauseShortage = battleUpcoming && resultingTotal < MIN_BATTLE_CARDS

  let warningMessage: string | null = null
  if (wouldCauseShortage) {
    warningMessage = `This choice will leave you with ${resultingTotal} cards, but you need ${MIN_BATTLE_CARDS} for battle.`
  }

  return {
    choiceId: transition.transitionId,
    transitionId: transition.transitionId,
    label: transition.presentation.choiceText || '',
    description: transition.presentation.previewHint,
    reputationPreviews,
    cardsGained,
    cardsLost,
    bountyModifier,
    triggersBattle,
    triggersAlliance,
    triggersMediation,
    consequenceHint: transition.presentation.previewHint,
    consequenceLevel: transition.presentation.consequenceLevel,
    cardImpact: {
      currentCardCount,
      gains,
      losses,
      netChange,
      resultingTotal,
      wouldCauseShortage,
      warningMessage
    }
  }
}

// ----------------------------------------------------------------------------
// Compatibility Layer
// ----------------------------------------------------------------------------

/**
 * Convert NarrativeViewData to the format expected by legacy dilemmaView consumers.
 * This allows gradual migration of UI components.
 */
export function toLegacyDilemmaView(view: NarrativeViewData): {
  dilemmaId: string
  questId: string
  questTitle: string
  situation: string
  voices: Array<{
    npcName: string
    factionId: string
    factionIcon: string
    factionColor: string
    dialogue: string
    position?: string
  }>
  choices: Array<{
    choiceId: string
    label: string
    description?: string
    reputationPreviews: ReputationPreviewData[]
    cardsGained: string[]
    cardsLost: string[]
    bountyModifier?: number
    triggersBattle: boolean
    triggersAlliance: boolean
    triggersMediation: boolean
    cardImpact: CardImpactData
  }>
  isPostBattle: boolean
  battleContext?: string
} {
  return {
    dilemmaId: view.nodeId,
    questId: view.questId,
    questTitle: view.questTitle,
    situation: view.situation,
    voices: view.voices,
    choices: view.choices.map(c => ({
      choiceId: c.choiceId,
      label: c.label,
      description: c.description,
      reputationPreviews: c.reputationPreviews,
      cardsGained: c.cardsGained,
      cardsLost: c.cardsLost,
      bountyModifier: c.bountyModifier || undefined,
      triggersBattle: c.triggersBattle,
      triggersAlliance: c.triggersAlliance,
      triggersMediation: c.triggersMediation,
      cardImpact: c.cardImpact
    })),
    isPostBattle: view.isPostBattle,
    battleContext: view.battleContext
  }
}
