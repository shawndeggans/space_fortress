// ============================================================================
// NARRATIVE GRAPH TYPES
// ============================================================================
//
// Core types for the narrative graph structure.
// The graph is static reference data - events track traversal, not structure.
//
// Based on: docs/design/NARRATIVE_FLOW.md
// ============================================================================

// ----------------------------------------------------------------------------
// Core Identifiers
// ----------------------------------------------------------------------------

export type NodeId = string      // Kebab-case IDs like "forest-clearing-first-visit"
export type TransitionId = string
export type ConditionId = string

// ----------------------------------------------------------------------------
// Graph Structure
// ----------------------------------------------------------------------------

export interface NarrativeGraph {
  graphId: string
  version: string
  metadata: GraphMetadata
  entryPoints: EntryPoint[]
  nodes: Map<NodeId, NarrativeNode>
  globalConditions: Map<ConditionId, ConditionDefinition>
}

export interface GraphMetadata {
  title: string
  author?: string
  totalNodeCount: number
  estimatedPlaythroughMinutes?: number
  tags: string[]
}

export interface EntryPoint {
  entryPointId: string
  startingNodeId: NodeId
  description?: string
  requiredFlags?: string[]
}

// ----------------------------------------------------------------------------
// Node Types
// ----------------------------------------------------------------------------

export type NodeType =
  | 'story'       // Standard narrative beat
  | 'choice'      // Player must select from options
  | 'branch'      // Automatic branching based on conditions
  | 'hub'         // Central location players return to
  | 'ending'      // Terminal node
  | 'checkpoint'  // Save/resume point

export interface NarrativeNode {
  nodeId: NodeId
  nodeType: NodeType
  content: NodeContent
  transitions: Transition[]
  metadata: NodeMetadata
}

export interface NodeContent {
  // Content can be inline or referenced
  contentType: 'inline' | 'reference'

  // For inline content
  text?: string

  // For referenced content (recommended for large narratives)
  contentRef?: ContentReference

  // Optional rich content
  speakerId?: string
  mood?: string
  media?: MediaAttachment[]

  // For choice nodes - the voices/dialogue options
  voices?: VoiceContent[]
}

export interface ContentReference {
  bundleId: string    // Which content bundle to load
  contentKey: string  // Key within the bundle
}

export interface MediaAttachment {
  type: 'image' | 'audio' | 'video'
  url: string
  alt?: string
}

export interface VoiceContent {
  npcName: string
  factionId: string
  dialogue: string
  position?: string
}

export interface NodeMetadata {
  isRevisitable: boolean       // Can player return here?
  requiresFlags: string[]      // Prerequisite state flags
  setsFlags: string[]          // Flags set upon visiting
  analytics?: AnalyticsConfig  // Tracking configuration
}

export interface AnalyticsConfig {
  trackVisits: boolean
  trackTime: boolean
  customEvents?: string[]
}

// ----------------------------------------------------------------------------
// Transition Types
// ----------------------------------------------------------------------------

export type TransitionType =
  | 'choice'      // Player explicitly selects this
  | 'automatic'   // Taken when conditions met (for branch nodes)
  | 'fallback'    // Default if no other conditions match
  | 'timed'       // Auto-advance after duration
  | 'event'       // Triggered by external game event

export interface Transition {
  transitionId: TransitionId
  targetNodeId: NodeId
  transitionType: TransitionType
  condition?: ConditionExpression
  presentation: TransitionPresentation
  effects: TransitionEffect[]
}

export interface TransitionPresentation {
  // For choice transitions
  choiceText?: string
  shortLabel?: string    // For UI buttons

  // Visual hints
  isHidden: boolean            // Don't show until conditions partially met
  isDisabled: boolean          // Show but prevent selection
  disabledReason?: string      // Explain why unavailable

  // Previews
  previewHint?: string         // "This will anger the king"
  consequenceLevel?: 'minor' | 'major' | 'irreversible'
}

export interface TransitionEffect {
  effectType: 'set_flag' | 'clear_flag' | 'increment' | 'decrement' | 'trigger_event'
  target: string
  value?: unknown
}

// ----------------------------------------------------------------------------
// Condition System
// ----------------------------------------------------------------------------

export type ConditionExpression =
  | SimpleCondition
  | CompoundCondition

export interface SimpleCondition {
  type: 'simple'
  conditionType: SimpleConditionType
  params: Record<string, unknown>
}

export type SimpleConditionType =
  | 'has_flag'           // { flag: string }
  | 'lacks_flag'         // { flag: string }
  | 'visited_node'       // { nodeId: NodeId }
  | 'not_visited_node'   // { nodeId: NodeId }
  | 'visit_count'        // { nodeId: NodeId, operator: '>' | '<' | '==', value: number }
  | 'flag_value'         // { flag: string, operator: comparison, value: unknown }
  | 'random'             // { probability: number 0-1 }
  | 'external'           // { conditionId: string } - resolved by game state

export interface CompoundCondition {
  type: 'compound'
  operator: 'and' | 'or' | 'not'
  conditions: ConditionExpression[]
}

export interface ConditionDefinition {
  conditionId: ConditionId
  description?: string
  expression: ConditionExpression
}

// ----------------------------------------------------------------------------
// Condition Result
// ----------------------------------------------------------------------------

export interface ConditionResult {
  satisfied: boolean
  failedConditions: string[]
}
