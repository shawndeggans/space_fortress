// ============================================================================
// NARRATIVE STATE (Projections)
// ============================================================================
//
// Derived state from narrative events.
// All state is rebuilt from events, never stored directly.
//
// ============================================================================

import type { NodeId, TransitionId, NodeContent, TransitionPresentation } from './graph'

// ----------------------------------------------------------------------------
// Primary Projection: Current Session State
// ----------------------------------------------------------------------------

export interface PlayerNarrativeState {
  sessionId: string
  playerId: string
  graphId: string
  graphVersion: string

  // Current position
  currentNodeId: NodeId

  // Traversal history
  visitedNodes: Map<NodeId, VisitRecord>
  transitionHistory: TransitionRecord[]

  // Dynamic state
  flags: Map<string, unknown>

  // Session metadata
  lastCheckpointId: string | null
  sessionStatus: 'active' | 'completed' | 'abandoned'
  startedAt: string
  lastActivityAt: string
}

export interface VisitRecord {
  nodeId: NodeId
  visitCount: number
  firstVisitAt: string
  lastVisitAt: string
}

export interface TransitionRecord {
  fromNodeId: NodeId
  toNodeId: NodeId
  transitionId: TransitionId
  transitionType: string
  timestamp: string
}

// ----------------------------------------------------------------------------
// UI-Focused Projection: Available Choices
// ----------------------------------------------------------------------------

export interface AvailableChoicesView {
  sessionId: string
  currentNodeId: NodeId
  nodeContent: ResolvedNodeContent
  choices: ResolvedChoice[]
  canGoBack: boolean
  backTargetNodeId?: NodeId
}

export interface ResolvedNodeContent {
  text: string
  speakerId?: string
  mood?: string
  voices?: ResolvedVoice[]
}

export interface ResolvedVoice {
  npcName: string
  factionId: string
  dialogue: string
  position?: string
}

export interface ResolvedChoice {
  transitionId: TransitionId
  targetNodeId: NodeId
  choiceText: string
  isAvailable: boolean
  unavailableReason?: string
  consequenceHint?: string
  consequenceLevel?: 'minor' | 'major' | 'irreversible'
  isHidden: boolean
}

// ----------------------------------------------------------------------------
// Navigation View (Current Position + Options)
// ----------------------------------------------------------------------------

export interface NarrativeNavigationView {
  // Current node info
  currentNodeId: NodeId
  currentNodeType: string
  nodeContent: ResolvedNodeContent

  // Available transitions (resolved against current state)
  availableTransitions: ResolvedTransition[]

  // Progress tracking
  visitedNodeCount: number
  currentVisitNumber: number  // How many times we've been here

  // Session info
  sessionStatus: 'active' | 'completed' | 'abandoned'
  canContinue: boolean
}

export interface ResolvedTransition {
  transitionId: TransitionId
  targetNodeId: NodeId
  transitionType: string
  presentation: TransitionPresentation
  isAvailable: boolean
  conditionsMet: boolean
  unavailableReason?: string
}

// ----------------------------------------------------------------------------
// Analytics Projection
// ----------------------------------------------------------------------------

export interface NarrativeAnalytics {
  graphId: string
  totalSessions: number
  completedSessions: number
  nodeVisitCounts: Map<NodeId, number>
  transitionCounts: Map<TransitionId, number>
  endingDistribution: Map<string, number>
  averageSessionDurationMs: number
  dropoffPoints: NodeId[]  // Nodes where players commonly abandon
}

// ----------------------------------------------------------------------------
// Initial State Factory
// ----------------------------------------------------------------------------

export function getInitialNarrativeState(): PlayerNarrativeState {
  return {
    sessionId: '',
    playerId: '',
    graphId: '',
    graphVersion: '',
    currentNodeId: '',
    visitedNodes: new Map(),
    transitionHistory: [],
    flags: new Map(),
    lastCheckpointId: null,
    sessionStatus: 'active',
    startedAt: '',
    lastActivityAt: ''
  }
}
