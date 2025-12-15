// ============================================================================
// NARRATIVE EVENTS
// ============================================================================
//
// Immutable facts of what happened in the narrative.
// These events are persisted and used to rebuild narrative state.
//
// ============================================================================

import type { NodeId, TransitionId } from './graph'

// ----------------------------------------------------------------------------
// Core Traversal Events
// ----------------------------------------------------------------------------

export interface NarrativeSessionStarted {
  type: 'NarrativeSessionStarted'
  data: {
    sessionId: string
    playerId: string
    graphId: string
    graphVersion: string
    entryPointId: string
    startingNodeId: NodeId
    timestamp: string
  }
}

export interface NarrativeNodeEntered {
  type: 'NarrativeNodeEntered'
  data: {
    sessionId: string
    nodeId: NodeId
    enteredFrom: NodeId | null  // null for entry points
    visitNumber: number         // 1st, 2nd, etc. visit to this node
    timestamp: string
  }
}

export interface NarrativeChoiceMade {
  type: 'NarrativeChoiceMade'
  data: {
    sessionId: string
    nodeId: NodeId
    transitionId: TransitionId
    targetNodeId: NodeId
    choiceIndex: number         // Which option (0-indexed) was selected
    availableChoices: number    // How many options were available
    timestamp: string
  }
}

export interface NarrativeTransitionTriggered {
  type: 'NarrativeTransitionTriggered'
  data: {
    sessionId: string
    transitionId: TransitionId
    fromNodeId: NodeId
    toNodeId: NodeId
    triggerType: 'automatic' | 'timed' | 'event' | 'fallback'
    timestamp: string
  }
}

// ----------------------------------------------------------------------------
// State Modification Events
// ----------------------------------------------------------------------------

export interface NarrativeFlagSet {
  type: 'NarrativeFlagSet'
  data: {
    sessionId: string
    flag: string
    value: unknown
    source: 'transition_effect' | 'node_entry' | 'external'
    sourceId: string  // transitionId, nodeId, or external event identifier
    timestamp: string
  }
}

export interface NarrativeFlagCleared {
  type: 'NarrativeFlagCleared'
  data: {
    sessionId: string
    flag: string
    previousValue: unknown
    source: 'transition_effect' | 'external'
    sourceId: string
    timestamp: string
  }
}

// ----------------------------------------------------------------------------
// Session Management Events
// ----------------------------------------------------------------------------

export interface NarrativeCheckpointReached {
  type: 'NarrativeCheckpointReached'
  data: {
    sessionId: string
    checkpointId: string
    nodeId: NodeId
    timestamp: string
  }
}

export interface NarrativeEndingReached {
  type: 'NarrativeEndingReached'
  data: {
    sessionId: string
    endingId: string
    nodeId: NodeId
    endingType: 'good' | 'bad' | 'neutral' | 'secret'
    pathSummary: PathSummary
    timestamp: string
  }
}

export interface NarrativeSessionResumed {
  type: 'NarrativeSessionResumed'
  data: {
    sessionId: string
    resumeFromCheckpoint: string
    resumeNodeId: NodeId
    timestamp: string
  }
}

// ----------------------------------------------------------------------------
// Integration Events
// ----------------------------------------------------------------------------

export interface NarrativeExternalEventReceived {
  type: 'NarrativeExternalEventReceived'
  data: {
    sessionId: string
    externalEventType: string
    payload: Record<string, unknown>
    timestamp: string
  }
}

// ----------------------------------------------------------------------------
// Supporting Types
// ----------------------------------------------------------------------------

export interface PathSummary {
  totalNodesVisited: number
  uniqueNodesVisited: number
  choicesMade: number
  flagsSet: string[]
  checkpointsReached: string[]
  sessionDurationMs: number
}

// ----------------------------------------------------------------------------
// Union Type
// ----------------------------------------------------------------------------

export type NarrativeEvent =
  | NarrativeSessionStarted
  | NarrativeNodeEntered
  | NarrativeChoiceMade
  | NarrativeTransitionTriggered
  | NarrativeFlagSet
  | NarrativeFlagCleared
  | NarrativeCheckpointReached
  | NarrativeEndingReached
  | NarrativeSessionResumed
  | NarrativeExternalEventReceived

// ----------------------------------------------------------------------------
// Type Guards
// ----------------------------------------------------------------------------

export function isNarrativeSessionStarted(event: NarrativeEvent): event is NarrativeSessionStarted {
  return event.type === 'NarrativeSessionStarted'
}

export function isNarrativeNodeEntered(event: NarrativeEvent): event is NarrativeNodeEntered {
  return event.type === 'NarrativeNodeEntered'
}

export function isNarrativeChoiceMade(event: NarrativeEvent): event is NarrativeChoiceMade {
  return event.type === 'NarrativeChoiceMade'
}

export function isNarrativeEndingReached(event: NarrativeEvent): event is NarrativeEndingReached {
  return event.type === 'NarrativeEndingReached'
}
