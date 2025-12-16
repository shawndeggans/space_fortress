// ============================================================================
// NAVIGATION HANDLER
// ============================================================================
//
// Handles navigation within narrative graphs.
// Emits events for state changes and tracks traversal history.
//
// ============================================================================

import type {
  NarrativeGraph,
  NarrativeNode,
  Transition,
  TransitionId,
  NodeId,
  NarrativeEvent,
  NarrativeNodeEntered,
  NarrativeChoiceMade,
  NarrativeTransitionTriggered,
  NarrativeFlagSet,
  ResolvedTransition,
  ResolvedChoice,
  AvailableChoicesView,
  ResolvedNodeContent,
  ResolvedVoice
} from '../types'
import type { PlayerNarrativeState } from '../types/state'
import type { ConditionResolver } from './condition-resolver'
import type { GraphLoader } from './graph-loader'

// ----------------------------------------------------------------------------
// Handler Interface
// ----------------------------------------------------------------------------

export interface NavigationHandler {
  /**
   * Get available transitions from the current node.
   */
  getAvailableTransitions(
    state: PlayerNarrativeState,
    playerId: string
  ): ResolvedTransition[]

  /**
   * Get choices view for the current node.
   */
  getChoicesView(
    state: PlayerNarrativeState,
    playerId: string
  ): AvailableChoicesView | null

  /**
   * Make a choice (select a transition).
   * Returns events to apply to state.
   */
  makeChoice(
    state: PlayerNarrativeState,
    playerId: string,
    transitionId: TransitionId
  ): NarrativeEvent[]

  /**
   * Enter a node directly.
   * Returns events to apply to state.
   */
  enterNode(
    state: PlayerNarrativeState,
    playerId: string,
    nodeId: NodeId,
    fromNodeId: NodeId | null
  ): NarrativeEvent[]
}

// ----------------------------------------------------------------------------
// Handler Implementation
// ----------------------------------------------------------------------------

export function createNavigationHandler(
  graphLoader: GraphLoader,
  conditionResolver: ConditionResolver
): NavigationHandler {
  return {
    getAvailableTransitions(
      state: PlayerNarrativeState,
      playerId: string
    ): ResolvedTransition[] {
      const node = graphLoader.getNode(state.graphId, state.currentNodeId)
      if (!node) return []

      return node.transitions.map(transition =>
        resolveTransition(transition, state, playerId, conditionResolver)
      )
    },

    getChoicesView(
      state: PlayerNarrativeState,
      playerId: string
    ): AvailableChoicesView | null {
      const node = graphLoader.getNode(state.graphId, state.currentNodeId)
      if (!node) return null

      const transitions = this.getAvailableTransitions(state, playerId)
      const choices = transitions
        .filter(t => t.transitionType === 'choice')
        .map(transitionToChoice)

      return {
        sessionId: state.sessionId,
        currentNodeId: state.currentNodeId,
        nodeContent: resolveNodeContent(node),
        choices,
        canGoBack: state.transitionHistory.length > 0,
        backTargetNodeId: state.transitionHistory.length > 0
          ? state.transitionHistory[state.transitionHistory.length - 1].fromNodeId
          : undefined
      }
    },

    makeChoice(
      state: PlayerNarrativeState,
      playerId: string,
      transitionId: TransitionId
    ): NarrativeEvent[] {
      const events: NarrativeEvent[] = []
      const timestamp = new Date().toISOString()

      const node = graphLoader.getNode(state.graphId, state.currentNodeId)
      if (!node) {
        console.error(`Current node not found: ${state.currentNodeId}`)
        return []
      }

      const transition = node.transitions.find(t => t.transitionId === transitionId)
      if (!transition) {
        console.error(`Transition not found: ${transitionId}`)
        return []
      }

      // Check if transition is available
      const resolved = resolveTransition(transition, state, playerId, conditionResolver)
      if (!resolved.isAvailable) {
        console.error(`Transition not available: ${transitionId}`, resolved.unavailableReason)
        return []
      }

      // Emit choice made event
      const choiceIndex = node.transitions
        .filter(t => t.transitionType === 'choice')
        .findIndex(t => t.transitionId === transitionId)

      const choiceMade: NarrativeChoiceMade = {
        type: 'NarrativeChoiceMade',
        data: {
          sessionId: state.sessionId,
          nodeId: state.currentNodeId,
          transitionId,
          targetNodeId: transition.targetNodeId,
          choiceIndex,
          availableChoices: node.transitions.filter(t => t.transitionType === 'choice').length,
          timestamp
        }
      }
      events.push(choiceMade)

      // Apply transition effects
      for (const effect of transition.effects) {
        if (effect.effectType === 'set_flag') {
          const flagSet: NarrativeFlagSet = {
            type: 'NarrativeFlagSet',
            data: {
              sessionId: state.sessionId,
              flag: effect.target,
              value: effect.value,
              source: 'transition_effect',
              sourceId: transitionId,
              timestamp
            }
          }
          events.push(flagSet)
        }
      }

      // Emit node entered event for target
      const visitNumber = (state.visitedNodes.get(transition.targetNodeId)?.visitCount ?? 0) + 1
      const nodeEntered: NarrativeNodeEntered = {
        type: 'NarrativeNodeEntered',
        data: {
          sessionId: state.sessionId,
          nodeId: transition.targetNodeId,
          enteredFrom: state.currentNodeId,
          visitNumber,
          timestamp
        }
      }
      events.push(nodeEntered)

      return events
    },

    enterNode(
      state: PlayerNarrativeState,
      playerId: string,
      nodeId: NodeId,
      fromNodeId: NodeId | null
    ): NarrativeEvent[] {
      const events: NarrativeEvent[] = []
      const timestamp = new Date().toISOString()

      const node = graphLoader.getNode(state.graphId, nodeId)
      if (!node) {
        console.error(`Node not found: ${nodeId}`)
        return []
      }

      // Emit node entered event
      const visitNumber = (state.visitedNodes.get(nodeId)?.visitCount ?? 0) + 1
      const nodeEntered: NarrativeNodeEntered = {
        type: 'NarrativeNodeEntered',
        data: {
          sessionId: state.sessionId,
          nodeId,
          enteredFrom: fromNodeId,
          visitNumber,
          timestamp
        }
      }
      events.push(nodeEntered)

      // Apply node entry flags
      for (const flag of node.metadata.setsFlags) {
        const flagSet: NarrativeFlagSet = {
          type: 'NarrativeFlagSet',
          data: {
            sessionId: state.sessionId,
            flag,
            value: true,
            source: 'node_entry',
            sourceId: nodeId,
            timestamp
          }
        }
        events.push(flagSet)
      }

      // Check for automatic transitions (for branch nodes)
      if (node.nodeType === 'branch') {
        const autoTransition = findAutomaticTransition(node, state, playerId, conditionResolver)
        if (autoTransition) {
          const triggered: NarrativeTransitionTriggered = {
            type: 'NarrativeTransitionTriggered',
            data: {
              sessionId: state.sessionId,
              transitionId: autoTransition.transitionId,
              fromNodeId: nodeId,
              toNodeId: autoTransition.targetNodeId,
              triggerType: autoTransition.transitionType === 'automatic' ? 'automatic' : 'fallback',
              timestamp
            }
          }
          events.push(triggered)

          // Recursively enter target node
          const targetEvents = this.enterNode(state, playerId, autoTransition.targetNodeId, nodeId)
          events.push(...targetEvents)
        }
      }

      return events
    }
  }
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

function resolveTransition(
  transition: Transition,
  state: PlayerNarrativeState,
  playerId: string,
  conditionResolver: ConditionResolver
): ResolvedTransition {
  let conditionsMet = true
  let unavailableReason: string | undefined

  if (transition.condition) {
    const result = conditionResolver.evaluate(transition.condition, state, playerId)
    conditionsMet = result.satisfied
    if (!conditionsMet) {
      unavailableReason = result.failedConditions.join(', ')
    }
  }

  const isAvailable = conditionsMet && !transition.presentation.isDisabled

  return {
    transitionId: transition.transitionId,
    targetNodeId: transition.targetNodeId,
    transitionType: transition.transitionType,
    presentation: transition.presentation,
    isAvailable,
    conditionsMet,
    unavailableReason: unavailableReason ?? transition.presentation.disabledReason
  }
}

function transitionToChoice(resolved: ResolvedTransition): ResolvedChoice {
  return {
    transitionId: resolved.transitionId,
    targetNodeId: resolved.targetNodeId,
    choiceText: resolved.presentation.choiceText ?? '',
    isAvailable: resolved.isAvailable,
    unavailableReason: resolved.unavailableReason,
    consequenceHint: resolved.presentation.previewHint,
    consequenceLevel: resolved.presentation.consequenceLevel,
    isHidden: resolved.presentation.isHidden
  }
}

function resolveNodeContent(node: NarrativeNode): ResolvedNodeContent {
  const content = node.content

  const resolved: ResolvedNodeContent = {
    text: content.text ?? '',
    speakerId: content.speakerId,
    mood: content.mood
  }

  if (content.voices) {
    resolved.voices = content.voices.map(v => ({
      npcName: v.npcName,
      factionId: v.factionId,
      dialogue: v.dialogue,
      position: v.position
    }))
  }

  return resolved
}

function findAutomaticTransition(
  node: NarrativeNode,
  state: PlayerNarrativeState,
  playerId: string,
  conditionResolver: ConditionResolver
): Transition | null {
  // First, try automatic transitions in order
  for (const transition of node.transitions) {
    if (transition.transitionType === 'automatic') {
      const resolved = resolveTransition(transition, state, playerId, conditionResolver)
      if (resolved.conditionsMet) {
        return transition
      }
    }
  }

  // Fall back to fallback transition
  const fallback = node.transitions.find(t => t.transitionType === 'fallback')
  return fallback ?? null
}
