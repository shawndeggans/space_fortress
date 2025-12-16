// ============================================================================
// NARRATIVE TYPES - Public API
// ============================================================================
//
// Re-exports all narrative type definitions.
//
// ============================================================================

// Graph structure types
export type {
  NodeId,
  TransitionId,
  ConditionId,
  NarrativeGraph,
  GraphMetadata,
  EntryPoint,
  NodeType,
  NarrativeNode,
  NodeContent,
  ContentReference,
  MediaAttachment,
  VoiceContent,
  NodeMetadata,
  AnalyticsConfig,
  TransitionType,
  Transition,
  TransitionPresentation,
  TransitionEffect,
  ConditionExpression,
  SimpleCondition,
  SimpleConditionType,
  CompoundCondition,
  ConditionDefinition,
  ConditionResult
} from './graph'

// Condition types and helpers
export type {
  ExternalConditionType,
  ExternalStateProvider
} from './conditions'

export {
  isSimpleCondition,
  isCompoundCondition,
  hasFlag,
  lacksFlag,
  visitedNode,
  allOf,
  anyOf,
  not,
  external
} from './conditions'

// Event types
export type {
  NarrativeSessionStarted,
  NarrativeNodeEntered,
  NarrativeChoiceMade,
  NarrativeTransitionTriggered,
  NarrativeFlagSet,
  NarrativeFlagCleared,
  NarrativeCheckpointReached,
  NarrativeEndingReached,
  NarrativeSessionResumed,
  NarrativeExternalEventReceived,
  PathSummary,
  NarrativeEvent
} from './events'

export {
  isNarrativeSessionStarted,
  isNarrativeNodeEntered,
  isNarrativeChoiceMade,
  isNarrativeEndingReached
} from './events'

// State types
export type {
  PlayerNarrativeState,
  VisitRecord,
  TransitionRecord,
  AvailableChoicesView,
  ResolvedNodeContent,
  ResolvedVoice,
  ResolvedChoice,
  NarrativeNavigationView,
  ResolvedTransition,
  NarrativeAnalytics
} from './state'

export { getInitialNarrativeState } from './state'
