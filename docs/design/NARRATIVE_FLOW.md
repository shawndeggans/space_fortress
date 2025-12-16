# Narrative Flow System Architecture

## Overview

This document defines the architecture for a large-scale "choose your own adventure" narrative system built on event sourcing principles. The system separates static narrative structure (the graph) from dynamic player state (events), enabling complex branching narratives while maintaining the simplicity of the event modeling approach.

## Core Architectural Principle

**The narrative graph is reference data. Events track traversal, not structure.**

```
┌─────────────────────────────────────────────────────────────────┐
│                    STATIC (Loaded at Runtime)                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Narrative Graph Definition                  │   │
│  │   Nodes, Transitions, Conditions, Content References    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ consulted by
┌─────────────────────────────────────────────────────────────────┐
│                    EVENT-SOURCED (Persisted)                    │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Commands   │───▶│    Events    │───▶│ Projections  │      │
│  │  (validate   │    │  (facts of   │    │  (derived    │      │
│  │   against    │    │  traversal)  │    │   state)     │      │
│  │   graph)     │    │              │    │              │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 1: Narrative Graph Structure (Static Reference Data)

### 1.1 Core Graph Types

```typescript
// ============================================================
// NARRATIVE GRAPH - Static, immutable after load
// ============================================================

interface NarrativeGraph {
  graphId: string;
  version: string;
  metadata: GraphMetadata;
  entryPoints: EntryPoint[];
  nodes: Map<NodeId, NarrativeNode>;
  globalConditions: Map<ConditionId, ConditionDefinition>;
}

interface GraphMetadata {
  title: string;
  author?: string;
  totalNodeCount: number;
  estimatedPlaythroughMinutes: number;
  tags: string[];
}

type NodeId = string;  // Recommend: kebab-case descriptive IDs like "forest-clearing-first-visit"
type ConditionId = string;
type TransitionId = string;
```

### 1.2 Node Structure

```typescript
interface NarrativeNode {
  nodeId: NodeId;
  nodeType: NodeType;
  content: NodeContent;
  transitions: Transition[];
  metadata: NodeMetadata;
}

type NodeType = 
  | 'story'        // Standard narrative beat
  | 'choice'       // Player must select from options
  | 'branch'       // Automatic branching based on conditions
  | 'hub'          // Central location players return to
  | 'ending'       // Terminal node
  | 'checkpoint';  // Save/resume point

interface NodeContent {
  // Content can be inline or referenced
  contentType: 'inline' | 'reference';
  
  // For inline content
  text?: string;
  
  // For referenced content (recommended for large narratives)
  contentRef?: ContentReference;
  
  // Optional rich content
  speakerId?: string;
  mood?: string;
  media?: MediaAttachment[];
}

interface ContentReference {
  bundleId: string;   // Which content bundle to load
  contentKey: string; // Key within the bundle
}

interface NodeMetadata {
  isRevisitable: boolean;      // Can player return here?
  requiresFlags: string[];     // Prerequisite state flags
  setsFlags: string[];         // Flags set upon visiting
  analytics: AnalyticsConfig;  // Tracking configuration
}
```

### 1.3 Transition Structure

```typescript
interface Transition {
  transitionId: TransitionId;
  targetNodeId: NodeId;
  transitionType: TransitionType;
  condition?: ConditionExpression;
  presentation: TransitionPresentation;
  effects: TransitionEffect[];
}

type TransitionType =
  | 'choice'      // Player explicitly selects this
  | 'automatic'   // Taken when conditions met (for branch nodes)
  | 'fallback'    // Default if no other conditions match
  | 'timed'       // Auto-advance after duration
  | 'event';      // Triggered by external game event

interface TransitionPresentation {
  // For choice transitions
  choiceText?: string;
  shortLabel?: string;  // For UI buttons
  
  // Visual hints
  isHidden: boolean;           // Don't show until conditions partially met
  isDisabled: boolean;         // Show but prevent selection
  disabledReason?: string;     // Explain why unavailable
  
  // Previews
  previewHint?: string;        // "This will anger the king"
  consequenceLevel?: 'minor' | 'major' | 'irreversible';
}

interface TransitionEffect {
  effectType: 'set_flag' | 'clear_flag' | 'increment' | 'decrement' | 'trigger_event';
  target: string;
  value?: unknown;
}
```

### 1.4 Condition System

```typescript
// Conditions are evaluated against PlayerNarrativeState
type ConditionExpression =
  | SimpleCondition
  | CompoundCondition;

interface SimpleCondition {
  type: 'simple';
  conditionType: SimpleConditionType;
  params: Record<string, unknown>;
}

type SimpleConditionType =
  | 'has_flag'           // { flag: string }
  | 'lacks_flag'         // { flag: string }
  | 'visited_node'       // { nodeId: NodeId }
  | 'not_visited_node'   // { nodeId: NodeId }
  | 'visit_count'        // { nodeId: NodeId, operator: '>' | '<' | '==', value: number }
  | 'flag_value'         // { flag: string, operator: comparison, value: unknown }
  | 'random'             // { probability: number 0-1 }
  | 'external';          // { conditionId: string } - resolved by game state

interface CompoundCondition {
  type: 'compound';
  operator: 'and' | 'or' | 'not';
  conditions: ConditionExpression[];
}
```

---

## Part 2: Event-Sourced Player State

### 2.1 Narrative Events

```typescript
// ============================================================
// EVENTS - Immutable facts of what happened
// ============================================================

type NarrativeEvent =
  | NarrativeSessionStarted
  | NarrativeNodeEntered
  | NarrativeChoiceMade
  | NarrativeTransitionTriggered
  | NarrativeFlagSet
  | NarrativeFlagCleared
  | NarrativeCheckpointReached
  | NarrativeEndingReached
  | NarrativeSessionResumed
  | NarrativeExternalEventReceived;

// Core traversal events
interface NarrativeSessionStarted {
  type: 'NarrativeSessionStarted';
  sessionId: string;
  playerId: string;
  graphId: string;
  graphVersion: string;
  entryPointId: string;
  startingNodeId: NodeId;
  timestamp: string;
}

interface NarrativeNodeEntered {
  type: 'NarrativeNodeEntered';
  sessionId: string;
  nodeId: NodeId;
  enteredFrom: NodeId | null;  // null for entry points
  visitNumber: number;         // 1st, 2nd, etc. visit to this node
  timestamp: string;
}

interface NarrativeChoiceMade {
  type: 'NarrativeChoiceMade';
  sessionId: string;
  nodeId: NodeId;
  transitionId: TransitionId;
  targetNodeId: NodeId;
  choiceIndex: number;         // Which option (0-indexed) was selected
  availableChoices: number;    // How many options were available
  timestamp: string;
}

interface NarrativeTransitionTriggered {
  type: 'NarrativeTransitionTriggered';
  sessionId: string;
  transitionId: TransitionId;
  fromNodeId: NodeId;
  toNodeId: NodeId;
  triggerType: 'automatic' | 'timed' | 'event' | 'fallback';
  timestamp: string;
}

// State modification events
interface NarrativeFlagSet {
  type: 'NarrativeFlagSet';
  sessionId: string;
  flag: string;
  value: unknown;
  source: 'transition_effect' | 'node_entry' | 'external';
  sourceId: string;  // transitionId, nodeId, or external event identifier
  timestamp: string;
}

interface NarrativeFlagCleared {
  type: 'NarrativeFlagCleared';
  sessionId: string;
  flag: string;
  previousValue: unknown;
  source: 'transition_effect' | 'external';
  sourceId: string;
  timestamp: string;
}

// Session management events
interface NarrativeCheckpointReached {
  type: 'NarrativeCheckpointReached';
  sessionId: string;
  checkpointId: string;
  nodeId: NodeId;
  timestamp: string;
}

interface NarrativeEndingReached {
  type: 'NarrativeEndingReached';
  sessionId: string;
  endingId: string;
  nodeId: NodeId;
  endingType: 'good' | 'bad' | 'neutral' | 'secret';
  pathSummary: PathSummary;  // For analytics
  timestamp: string;
}

interface NarrativeSessionResumed {
  type: 'NarrativeSessionResumed';
  sessionId: string;
  resumeFromCheckpoint: string;
  resumeNodeId: NodeId;
  timestamp: string;
}

// Integration events
interface NarrativeExternalEventReceived {
  type: 'NarrativeExternalEventReceived';
  sessionId: string;
  externalEventType: string;
  payload: Record<string, unknown>;
  timestamp: string;
}
```

### 2.2 Commands

```typescript
// ============================================================
// COMMANDS - Intentions to change state
// ============================================================

type NarrativeCommand =
  | StartNarrativeSession
  | SelectChoice
  | TriggerExternalEvent
  | ResumeFromCheckpoint
  | AdvanceAutomaticTransition;

interface StartNarrativeSession {
  type: 'StartNarrativeSession';
  playerId: string;
  graphId: string;
  entryPointId?: string;  // Optional, uses default if not specified
}

interface SelectChoice {
  type: 'SelectChoice';
  sessionId: string;
  transitionId: TransitionId;
}

interface TriggerExternalEvent {
  type: 'TriggerExternalEvent';
  sessionId: string;
  externalEventType: string;
  payload: Record<string, unknown>;
}

interface ResumeFromCheckpoint {
  type: 'ResumeFromCheckpoint';
  sessionId: string;
  checkpointId: string;
}

interface AdvanceAutomaticTransition {
  type: 'AdvanceAutomaticTransition';
  sessionId: string;
  // System command - triggered by automation, not player
}
```

### 2.3 Projections (Read Models)

```typescript
// ============================================================
// PROJECTIONS - Derived from events, rebuilt on demand
// ============================================================

// Primary projection: Current session state
interface PlayerNarrativeState {
  sessionId: string;
  playerId: string;
  graphId: string;
  graphVersion: string;
  
  // Current position
  currentNodeId: NodeId;
  
  // Traversal history
  visitedNodes: Map<NodeId, VisitRecord>;
  transitionHistory: TransitionRecord[];
  
  // Dynamic state
  flags: Map<string, unknown>;
  
  // Session metadata
  lastCheckpointId: string | null;
  sessionStatus: 'active' | 'completed' | 'abandoned';
  startedAt: string;
  lastActivityAt: string;
}

interface VisitRecord {
  nodeId: NodeId;
  visitCount: number;
  firstVisitAt: string;
  lastVisitAt: string;
}

interface TransitionRecord {
  fromNodeId: NodeId;
  toNodeId: NodeId;
  transitionId: TransitionId;
  transitionType: string;
  timestamp: string;
}

// UI-focused projection: Available choices at current node
interface AvailableChoicesView {
  sessionId: string;
  currentNodeId: NodeId;
  nodeContent: ResolvedNodeContent;
  choices: ResolvedChoice[];
  canGoBack: boolean;
  backTargetNodeId?: NodeId;
}

interface ResolvedChoice {
  transitionId: TransitionId;
  choiceText: string;
  isAvailable: boolean;
  unavailableReason?: string;
  consequenceHint?: string;
  consequenceLevel?: string;
}

interface ResolvedNodeContent {
  text: string;
  speakerId?: string;
  mood?: string;
  media?: MediaAttachment[];
}

// Analytics projection: Path statistics
interface NarrativeAnalytics {
  graphId: string;
  totalSessions: number;
  completedSessions: number;
  nodeVisitCounts: Map<NodeId, number>;
  transitionCounts: Map<TransitionId, number>;
  endingDistribution: Map<string, number>;
  averageSessionDuration: number;
  dropoffPoints: NodeId[];  // Nodes where players commonly abandon
}
```

---

## Part 3: Command Handlers

### 3.1 Handler Architecture

```typescript
// ============================================================
// COMMAND HANDLERS - Validate and produce events
// ============================================================

interface NarrativeCommandHandler {
  handle(
    command: NarrativeCommand,
    currentState: PlayerNarrativeState | null,
    graph: NarrativeGraph,
    conditionResolver: ConditionResolver
  ): Result<NarrativeEvent[], NarrativeError>;
}
```

### 3.2 Validation Strategy

Command handlers follow this validation sequence:

```
1. STRUCTURAL VALIDATION
   - Does the referenced session exist?
   - Does the referenced node/transition exist in the graph?
   - Is the graph version compatible?

2. STATE VALIDATION  
   - Is the player at a node where this command makes sense?
   - Is the session still active (not completed/abandoned)?

3. BUSINESS RULE VALIDATION
   - Are transition conditions met?
   - Is the transition available from current node?
   - Are all prerequisites satisfied?

4. EVENT GENERATION
   - Create events representing the state change
   - Include all effects (flag changes, etc.)
```

### 3.3 Error Types

```typescript
type NarrativeError =
  | { type: 'SessionNotFound'; sessionId: string }
  | { type: 'SessionCompleted'; sessionId: string; endingId: string }
  | { type: 'GraphNotFound'; graphId: string }
  | { type: 'GraphVersionMismatch'; expected: string; actual: string }
  | { type: 'NodeNotFound'; nodeId: NodeId }
  | { type: 'TransitionNotFound'; transitionId: TransitionId }
  | { type: 'TransitionNotAvailable'; transitionId: TransitionId; fromNodeId: NodeId }
  | { type: 'ConditionNotMet'; transitionId: TransitionId; failedConditions: string[] }
  | { type: 'InvalidNodeType'; nodeId: NodeId; expectedType: NodeType; actualType: NodeType }
  | { type: 'CheckpointNotFound'; checkpointId: string }
  | { type: 'InvalidEntryPoint'; entryPointId: string };
```

### 3.4 Handler Pseudocode

```typescript
// SelectChoice handler - the most common operation
function handleSelectChoice(
  command: SelectChoice,
  state: PlayerNarrativeState,
  graph: NarrativeGraph,
  resolver: ConditionResolver
): Result<NarrativeEvent[], NarrativeError> {
  
  // 1. Structural validation
  const currentNode = graph.nodes.get(state.currentNodeId);
  if (!currentNode) {
    return Err({ type: 'NodeNotFound', nodeId: state.currentNodeId });
  }
  
  const transition = currentNode.transitions.find(t => t.transitionId === command.transitionId);
  if (!transition) {
    return Err({ 
      type: 'TransitionNotAvailable', 
      transitionId: command.transitionId, 
      fromNodeId: state.currentNodeId 
    });
  }
  
  const targetNode = graph.nodes.get(transition.targetNodeId);
  if (!targetNode) {
    return Err({ type: 'NodeNotFound', nodeId: transition.targetNodeId });
  }
  
  // 2. State validation
  if (state.sessionStatus !== 'active') {
    return Err({ type: 'SessionCompleted', sessionId: state.sessionId, endingId: '...' });
  }
  
  // 3. Business rule validation
  if (transition.condition) {
    const conditionResult = resolver.evaluate(transition.condition, state);
    if (!conditionResult.satisfied) {
      return Err({ 
        type: 'ConditionNotMet', 
        transitionId: transition.transitionId,
        failedConditions: conditionResult.failedConditions 
      });
    }
  }
  
  // 4. Event generation
  const events: NarrativeEvent[] = [];
  const now = new Date().toISOString();
  
  // Record the choice
  events.push({
    type: 'NarrativeChoiceMade',
    sessionId: state.sessionId,
    nodeId: state.currentNodeId,
    transitionId: transition.transitionId,
    targetNodeId: targetNode.nodeId,
    choiceIndex: currentNode.transitions.indexOf(transition),
    availableChoices: currentNode.transitions.filter(t => 
      resolver.evaluate(t.condition, state).satisfied
    ).length,
    timestamp: now
  });
  
  // Apply transition effects
  for (const effect of transition.effects) {
    events.push(...generateEffectEvents(effect, state.sessionId, transition.transitionId, now));
  }
  
  // Record entering new node
  const visitNumber = (state.visitedNodes.get(targetNode.nodeId)?.visitCount ?? 0) + 1;
  events.push({
    type: 'NarrativeNodeEntered',
    sessionId: state.sessionId,
    nodeId: targetNode.nodeId,
    enteredFrom: state.currentNodeId,
    visitNumber,
    timestamp: now
  });
  
  // Apply node entry effects
  for (const flag of targetNode.metadata.setsFlags) {
    events.push({
      type: 'NarrativeFlagSet',
      sessionId: state.sessionId,
      flag,
      value: true,
      source: 'node_entry',
      sourceId: targetNode.nodeId,
      timestamp: now
    });
  }
  
  // Check for ending
  if (targetNode.nodeType === 'ending') {
    events.push({
      type: 'NarrativeEndingReached',
      sessionId: state.sessionId,
      endingId: targetNode.nodeId,
      nodeId: targetNode.nodeId,
      endingType: determineEndingType(targetNode),
      pathSummary: buildPathSummary(state),
      timestamp: now
    });
  }
  
  // Check for checkpoint
  if (targetNode.nodeType === 'checkpoint') {
    events.push({
      type: 'NarrativeCheckpointReached',
      sessionId: state.sessionId,
      checkpointId: targetNode.nodeId,
      nodeId: targetNode.nodeId,
      timestamp: now
    });
  }
  
  return Ok(events);
}
```

---

## Part 4: Graph Validation

### 4.1 Compile-Time Validation

Run these checks when loading/building the narrative graph:

```typescript
interface GraphValidationResult {
  isValid: boolean;
  errors: GraphValidationError[];
  warnings: GraphValidationWarning[];
  statistics: GraphStatistics;
}

type GraphValidationError =
  | { type: 'BrokenLink'; fromNodeId: NodeId; transitionId: TransitionId; targetNodeId: NodeId }
  | { type: 'OrphanedNode'; nodeId: NodeId }  // Unreachable from any entry point
  | { type: 'DeadEnd'; nodeId: NodeId }       // No transitions and not an ending
  | { type: 'MissingEntryPoint'; graphId: string }
  | { type: 'DuplicateNodeId'; nodeId: NodeId }
  | { type: 'DuplicateTransitionId'; transitionId: TransitionId }
  | { type: 'CircularOnlyPath'; nodeIds: NodeId[] }  // Only way forward loops back
  | { type: 'InvalidConditionReference'; conditionId: ConditionId };

type GraphValidationWarning =
  | { type: 'UnreachableEnding'; nodeId: NodeId; reason: string }
  | { type: 'SinglePathStretch'; nodeIds: NodeId[] }  // Long stretch with no choices
  | { type: 'HighFanout'; nodeId: NodeId; transitionCount: number }
  | { type: 'DeepNesting'; maxDepth: number; threshold: number }
  | { type: 'PotentialSoftlock'; nodeId: NodeId; conditions: string[] };

interface GraphStatistics {
  totalNodes: number;
  totalTransitions: number;
  nodesByType: Record<NodeType, number>;
  entryPointCount: number;
  endingCount: number;
  maxPathLength: number;
  minPathLength: number;
  averageBranchingFactor: number;
  reachabilityPercentage: number;
}
```

### 4.2 Validation Functions

```typescript
function validateGraph(graph: NarrativeGraph): GraphValidationResult {
  const errors: GraphValidationError[] = [];
  const warnings: GraphValidationWarning[] = [];
  
  // Check all transitions point to valid nodes
  for (const [nodeId, node] of graph.nodes) {
    for (const transition of node.transitions) {
      if (!graph.nodes.has(transition.targetNodeId)) {
        errors.push({
          type: 'BrokenLink',
          fromNodeId: nodeId,
          transitionId: transition.transitionId,
          targetNodeId: transition.targetNodeId
        });
      }
    }
    
    // Check for dead ends
    if (node.transitions.length === 0 && node.nodeType !== 'ending') {
      errors.push({ type: 'DeadEnd', nodeId });
    }
  }
  
  // Check reachability from all entry points
  const reachable = computeReachableNodes(graph);
  for (const [nodeId] of graph.nodes) {
    if (!reachable.has(nodeId)) {
      errors.push({ type: 'OrphanedNode', nodeId });
    }
  }
  
  // Check for potential softlocks (nodes you can enter but not exit)
  for (const [nodeId, node] of graph.nodes) {
    if (node.nodeType !== 'ending') {
      const canExit = node.transitions.some(t => 
        !t.condition || isAlwaysSatisfiable(t.condition)
      );
      if (!canExit) {
        warnings.push({
          type: 'PotentialSoftlock',
          nodeId,
          conditions: node.transitions.map(t => 
            t.condition ? conditionToString(t.condition) : 'none'
          )
        });
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    statistics: computeStatistics(graph)
  };
}

function computeReachableNodes(graph: NarrativeGraph): Set<NodeId> {
  const reachable = new Set<NodeId>();
  const queue: NodeId[] = [];
  
  // Start from all entry points
  for (const entry of graph.entryPoints) {
    queue.push(entry.startingNodeId);
  }
  
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (reachable.has(nodeId)) continue;
    
    reachable.add(nodeId);
    
    const node = graph.nodes.get(nodeId);
    if (node) {
      for (const transition of node.transitions) {
        if (!reachable.has(transition.targetNodeId)) {
          queue.push(transition.targetNodeId);
        }
      }
    }
  }
  
  return reachable;
}
```

---

## Part 5: Graph Definition Format

### 5.1 Recommended File Structure

```
narrative/
├── graphs/
│   ├── main-story/
│   │   ├── graph.yaml           # Graph structure definition
│   │   ├── conditions.yaml      # Reusable condition definitions
│   │   └── metadata.yaml        # Graph metadata
│   └── side-quest-01/
│       └── ...
├── content/
│   ├── main-story/
│   │   ├── chapter-01.yaml      # Content bundles (text, dialogue)
│   │   └── chapter-02.yaml
│   └── shared/
│       └── common-responses.yaml
└── schemas/
    ├── graph.schema.json        # JSON Schema for validation
    └── content.schema.json
```

### 5.2 YAML Graph Format

```yaml
# graph.yaml
graphId: main-story
version: "1.2.0"
metadata:
  title: "The Dark Forest"
  estimatedPlaythroughMinutes: 45
  tags: [fantasy, mystery, branching]

entryPoints:
  - entryPointId: default
    startingNodeId: intro-awakening
    description: "Start from the beginning"
  - entryPointId: chapter-2
    startingNodeId: village-arrival
    requiredFlags: [completed-chapter-1]
    description: "Start at Chapter 2"

nodes:
  intro-awakening:
    nodeType: story
    content:
      contentRef:
        bundleId: chapter-01
        contentKey: awakening
    transitions:
      - transitionId: intro-look-around
        targetNodeId: intro-surroundings
        transitionType: choice
        presentation:
          choiceText: "Look around the clearing"
      - transitionId: intro-check-pockets
        targetNodeId: intro-inventory
        transitionType: choice
        presentation:
          choiceText: "Check your pockets"
    metadata:
      setsFlags: [game-started]
      
  intro-surroundings:
    nodeType: choice
    content:
      contentRef:
        bundleId: chapter-01
        contentKey: surroundings
    transitions:
      - transitionId: surroundings-forest
        targetNodeId: forest-edge
        transitionType: choice
        presentation:
          choiceText: "Head toward the forest"
          consequenceHint: "The forest looks dark and foreboding"
          consequenceLevel: major
      - transitionId: surroundings-path
        targetNodeId: worn-path
        transitionType: choice
        presentation:
          choiceText: "Follow the worn path"
        effects:
          - effectType: set_flag
            target: chose-safe-path
            value: true
      - transitionId: surroundings-wait
        targetNodeId: intro-wait
        transitionType: choice
        condition:
          type: simple
          conditionType: has_flag
          params:
            flag: found-note
        presentation:
          choiceText: "Wait and read the note again"
          isHidden: true  # Only shows if condition met

  forest-edge:
    nodeType: branch
    content:
      text: ""  # Branch nodes may have no content
    transitions:
      - transitionId: forest-night
        targetNodeId: forest-night-encounter
        transitionType: automatic
        condition:
          type: simple
          conditionType: has_flag
          params:
            flag: is-nighttime
      - transitionId: forest-day
        targetNodeId: forest-day-exploration
        transitionType: fallback
        
  bad-ending-lost:
    nodeType: ending
    content:
      contentRef:
        bundleId: chapter-01
        contentKey: ending-lost
    transitions: []
    metadata:
      analytics:
        endingType: bad
        endingId: lost-in-forest
```

### 5.3 Content Bundle Format

```yaml
# content/main-story/chapter-01.yaml
bundleId: chapter-01

content:
  awakening:
    text: |
      You open your eyes slowly. Above you, branches sway gently 
      against a grey sky. Your head throbs. How did you get here?
      
      The grass beneath you is damp with morning dew.
    speakerId: narrator
    mood: mysterious
    
  surroundings:
    text: |
      The clearing is roughly circular, about thirty paces across. 
      To the north, dense forest presses close. To the south, 
      a worn dirt path winds between the trees.
    speakerId: narrator
    
  ending-lost:
    text: |
      The forest has claimed another soul. Your journey ends here,
      lost among the endless trees, your story untold.
    speakerId: narrator
    mood: somber
```

---

## Part 6: Runtime Architecture

### 6.1 Component Responsibilities

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Narrative System                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │  Graph Loader   │  │ Content Loader  │  │Condition Resolver│    │
│  │                 │  │                 │  │                 │     │
│  │ - Load YAML     │  │ - Lazy load     │  │ - Evaluate      │     │
│  │ - Validate      │  │   bundles       │  │   conditions    │     │
│  │ - Index nodes   │  │ - Cache content │  │ - External      │     │
│  │                 │  │                 │  │   state bridge  │     │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘     │
│           │                    │                    │               │
│           └────────────────────┼────────────────────┘               │
│                                │                                    │
│                    ┌───────────▼───────────┐                        │
│                    │   Command Handler     │                        │
│                    │                       │                        │
│                    │ - Validate commands   │                        │
│                    │ - Consult graph       │                        │
│                    │ - Produce events      │                        │
│                    └───────────┬───────────┘                        │
│                                │                                    │
│                    ┌───────────▼───────────┐                        │
│                    │    Event Store        │                        │
│                    │                       │                        │
│                    │ - Persist events      │                        │
│                    │ - Stream by session   │                        │
│                    └───────────┬───────────┘                        │
│                                │                                    │
│           ┌────────────────────┼────────────────────┐               │
│           │                    │                    │               │
│  ┌────────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐     │
│  │ Session State   │  │ Available       │  │  Analytics      │     │
│  │ Projection      │  │ Choices View    │  │  Projection     │     │
│  │                 │  │                 │  │                 │     │
│  │ Current node,   │  │ What player     │  │ Aggregate       │     │
│  │ flags, history  │  │ can do now      │  │ statistics      │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 External State Integration

The narrative system needs to query game state for conditions:

```typescript
// Bridge to external game state
interface ExternalStateProvider {
  // Query game state for condition evaluation
  evaluateExternalCondition(
    conditionId: string,
    playerId: string,
    params: Record<string, unknown>
  ): boolean;
  
  // Notify game of narrative events
  onNarrativeEvent(event: NarrativeEvent): void;
}

// Example external conditions
type ExternalConditionType =
  | 'player_has_item'      // Inventory system
  | 'player_level_gte'     // Progression system
  | 'quest_completed'      // Quest system
  | 'npc_relationship'     // Relationship system
  | 'world_state'          // Global game state
  | 'time_of_day';         // Game clock

// Condition resolver uses the provider
class ConditionResolver {
  constructor(
    private externalProvider: ExternalStateProvider
  ) {}
  
  evaluate(
    condition: ConditionExpression,
    narrativeState: PlayerNarrativeState
  ): ConditionResult {
    if (condition.type === 'simple') {
      return this.evaluateSimple(condition, narrativeState);
    } else {
      return this.evaluateCompound(condition, narrativeState);
    }
  }
  
  private evaluateSimple(
    condition: SimpleCondition,
    state: PlayerNarrativeState
  ): ConditionResult {
    switch (condition.conditionType) {
      case 'has_flag':
        return { 
          satisfied: state.flags.has(condition.params.flag as string),
          failedConditions: []
        };
        
      case 'visited_node':
        return {
          satisfied: state.visitedNodes.has(condition.params.nodeId as NodeId),
          failedConditions: []
        };
        
      case 'external':
        // Delegate to game state
        const satisfied = this.externalProvider.evaluateExternalCondition(
          condition.params.conditionId as string,
          state.playerId,
          condition.params
        );
        return { satisfied, failedConditions: satisfied ? [] : [condition.params.conditionId as string] };
        
      // ... other condition types
    }
  }
}
```

### 6.3 Automation Handler

For automatic transitions (branch nodes, timed transitions):

```typescript
// Processor that handles automatic narrative progression
class NarrativeAutomationProcessor {
  constructor(
    private graph: NarrativeGraph,
    private conditionResolver: ConditionResolver,
    private commandHandler: NarrativeCommandHandler
  ) {}
  
  // Called after each NodeEntered event
  processAutomaticTransitions(
    state: PlayerNarrativeState
  ): NarrativeEvent[] {
    const currentNode = this.graph.nodes.get(state.currentNodeId);
    if (!currentNode) return [];
    
    // Only process automatic transitions for branch nodes
    if (currentNode.nodeType !== 'branch') return [];
    
    // Find first matching automatic transition
    for (const transition of currentNode.transitions) {
      if (transition.transitionType === 'automatic') {
        if (!transition.condition || 
            this.conditionResolver.evaluate(transition.condition, state).satisfied) {
          // Trigger the automatic transition
          const result = this.commandHandler.handle(
            { type: 'AdvanceAutomaticTransition', sessionId: state.sessionId },
            state,
            this.graph,
            this.conditionResolver
          );
          
          if (result.ok) return result.value;
        }
      }
    }
    
    // Check for fallback transition
    const fallback = currentNode.transitions.find(t => t.transitionType === 'fallback');
    if (fallback) {
      // Use fallback...
    }
    
    return [];
  }
}
```

---

## Part 7: Testing Patterns

### 7.1 Graph-Level Tests

```typescript
// Test that critical paths are reachable
describe('MainStory Graph', () => {
  let graph: NarrativeGraph;
  
  beforeAll(() => {
    graph = loadGraph('main-story');
  });
  
  it('should have no broken links', () => {
    const result = validateGraph(graph);
    expect(result.errors.filter(e => e.type === 'BrokenLink')).toEqual([]);
  });
  
  it('should have no orphaned nodes', () => {
    const result = validateGraph(graph);
    expect(result.errors.filter(e => e.type === 'OrphanedNode')).toEqual([]);
  });
  
  it('should have all endings reachable', () => {
    const endings = [...graph.nodes.values()]
      .filter(n => n.nodeType === 'ending')
      .map(n => n.nodeId);
    
    const reachable = computeReachableNodes(graph);
    
    for (const ending of endings) {
      expect(reachable.has(ending)).toBe(true);
    }
  });
  
  it('should have no softlock potential', () => {
    const result = validateGraph(graph);
    expect(result.warnings.filter(w => w.type === 'PotentialSoftlock')).toEqual([]);
  });
});
```

### 7.2 Narrative Path Tests (Given-When-Then)

```typescript
// Test specific narrative paths
describe('Forest Path', () => {
  it('should reach bad ending when entering forest at night without torch', () => {
    // Given
    const events: NarrativeEvent[] = [
      { type: 'NarrativeSessionStarted', sessionId: 's1', ... },
      { type: 'NarrativeNodeEntered', nodeId: 'intro-awakening', ... },
      { type: 'NarrativeFlagSet', flag: 'is-nighttime', value: true, ... },
    ];
    const state = projectState(events);
    
    // When
    const result = handleSelectChoice(
      { type: 'SelectChoice', sessionId: 's1', transitionId: 'surroundings-forest' },
      state,
      graph,
      resolver
    );
    
    // Then
    expect(result.ok).toBe(true);
    const endingEvent = result.value.find(e => e.type === 'NarrativeEndingReached');
    expect(endingEvent).toBeDefined();
    expect(endingEvent.endingType).toBe('bad');
  });
  
  it('should allow forest entry with torch at night', () => {
    // Given
    const events: NarrativeEvent[] = [
      // ... setup events including torch acquisition
      { type: 'NarrativeFlagSet', flag: 'has-torch', value: true, ... },
      { type: 'NarrativeFlagSet', flag: 'is-nighttime', value: true, ... },
    ];
    const state = projectState(events);
    
    // When
    const result = handleSelectChoice(
      { type: 'SelectChoice', sessionId: 's1', transitionId: 'surroundings-forest' },
      state,
      graph,
      resolver
    );
    
    // Then
    expect(result.ok).toBe(true);
    expect(result.value.some(e => 
      e.type === 'NarrativeNodeEntered' && e.nodeId === 'forest-night-with-torch'
    )).toBe(true);
  });
});
```

### 7.3 Timeline Tests

```typescript
// Test full narrative timelines
describe('Complete Playthrough', () => {
  it('should complete good ending path', () => {
    const timeline = new NarrativeTimelineTest(graph);
    
    timeline
      .startSession('default')
      .expectNode('intro-awakening')
      .selectChoice('intro-check-pockets')
      .expectNode('intro-inventory')
      .expectFlag('found-note')
      .selectChoice('inventory-return')
      .expectNode('intro-awakening')
      .selectChoice('intro-look-around')
      .expectNode('intro-surroundings')
      // Hidden choice should now be visible
      .expectAvailableChoice('surroundings-wait')
      .selectChoice('surroundings-wait')
      .expectNode('intro-wait')
      // ... continue path
      .selectChoice('final-choice-help')
      .expectEnding('good-ending-hero')
      .verify();
  });
});
```

---

## Part 8: Performance Considerations

### 8.1 Large Graph Handling

For narratives with thousands of nodes:

```typescript
interface GraphLoadingStrategy {
  // Full load for small graphs (< 500 nodes)
  loadFull(graphId: string): NarrativeGraph;
  
  // Chunked load for medium graphs (500-5000 nodes)
  loadChapter(graphId: string, chapterId: string): NarrativeGraphChunk;
  
  // On-demand load for large graphs (> 5000 nodes)
  loadNode(graphId: string, nodeId: NodeId): NarrativeNode;
  loadAdjacentNodes(graphId: string, nodeId: NodeId, depth: number): Map<NodeId, NarrativeNode>;
}

// Chunk structure for partial loading
interface NarrativeGraphChunk {
  graphId: string;
  chunkId: string;
  nodes: Map<NodeId, NarrativeNode>;
  boundaryNodes: Set<NodeId>;  // Nodes that link to other chunks
  linkedChunks: Map<NodeId, string>;  // nodeId -> chunkId for external links
}
```

### 8.2 Content Lazy Loading

```typescript
class ContentLoader {
  private cache: Map<string, ContentBundle> = new Map();
  private loading: Map<string, Promise<ContentBundle>> = new Map();
  
  async getContent(ref: ContentReference): Promise<string> {
    // Check cache
    if (this.cache.has(ref.bundleId)) {
      return this.cache.get(ref.bundleId)!.content[ref.contentKey].text;
    }
    
    // Check if already loading
    if (this.loading.has(ref.bundleId)) {
      const bundle = await this.loading.get(ref.bundleId)!;
      return bundle.content[ref.contentKey].text;
    }
    
    // Start loading
    const loadPromise = this.loadBundle(ref.bundleId);
    this.loading.set(ref.bundleId, loadPromise);
    
    const bundle = await loadPromise;
    this.cache.set(ref.bundleId, bundle);
    this.loading.delete(ref.bundleId);
    
    return bundle.content[ref.contentKey].text;
  }
  
  // Predictive loading based on current node
  async preloadAdjacentContent(
    graph: NarrativeGraph, 
    currentNodeId: NodeId,
    depth: number = 2
  ): Promise<void> {
    const nodesToPreload = this.findNodesWithinDepth(graph, currentNodeId, depth);
    const bundlesToLoad = new Set<string>();
    
    for (const nodeId of nodesToPreload) {
      const node = graph.nodes.get(nodeId);
      if (node?.content.contentRef) {
        bundlesToLoad.add(node.content.contentRef.bundleId);
      }
    }
    
    await Promise.all([...bundlesToLoad].map(id => this.loadBundle(id)));
  }
}
```

### 8.3 State Projection Caching

```typescript
// Snapshot strategy for long sessions
interface SessionSnapshot {
  sessionId: string;
  eventCount: number;
  state: PlayerNarrativeState;
  snapshotAt: string;
}

class NarrativeStateProjection {
  private snapshots: Map<string, SessionSnapshot> = new Map();
  private snapshotInterval: number = 50;  // Snapshot every 50 events
  
  project(events: NarrativeEvent[]): PlayerNarrativeState {
    if (events.length === 0) {
      throw new Error('Cannot project empty event stream');
    }
    
    const sessionId = events[0].sessionId;
    
    // Find most recent applicable snapshot
    const snapshot = this.snapshots.get(sessionId);
    let state: PlayerNarrativeState;
    let startIndex: number;
    
    if (snapshot && snapshot.eventCount <= events.length) {
      state = { ...snapshot.state };
      startIndex = snapshot.eventCount;
    } else {
      state = this.initialState(events[0] as NarrativeSessionStarted);
      startIndex = 1;
    }
    
    // Apply events from snapshot point
    for (let i = startIndex; i < events.length; i++) {
      state = this.applyEvent(state, events[i]);
    }
    
    // Create new snapshot if needed
    if (events.length - (snapshot?.eventCount ?? 0) >= this.snapshotInterval) {
      this.snapshots.set(sessionId, {
        sessionId,
        eventCount: events.length,
        state: { ...state },
        snapshotAt: new Date().toISOString()
      });
    }
    
    return state;
  }
}
```

---

## Part 9: Integration Checklist

### For Your Coding Agent

When implementing this system, verify these integration points:

- [ ] **Graph loader** validates on load, fails fast on broken graphs
- [ ] **Event store** uses same infrastructure as rest of game
- [ ] **Command handlers** follow existing event modeling patterns
- [ ] **Projections** rebuild from events, no hidden state
- [ ] **External state bridge** connects to game's condition evaluators
- [ ] **Automation processor** registered with event bus for automatic transitions
- [ ] **Content loader** handles async content resolution
- [ ] **Error types** integrate with game's error handling
- [ ] **Analytics events** flow to game's analytics pipeline
- [ ] **Tests** use existing Given-When-Then patterns

### Files to Create

```
src/narrative/
├── types/
│   ├── graph.ts           # NarrativeGraph, NarrativeNode, Transition
│   ├── events.ts          # All NarrativeEvent types
│   ├── commands.ts        # All NarrativeCommand types
│   ├── projections.ts     # PlayerNarrativeState, views
│   └── errors.ts          # NarrativeError types
├── graph/
│   ├── loader.ts          # YAML parsing, graph construction
│   ├── validator.ts       # Graph validation logic
│   └── content-loader.ts  # Lazy content loading
├── handlers/
│   ├── start-session.ts
│   ├── select-choice.ts
│   ├── resume-checkpoint.ts
│   └── index.ts           # Handler registry
├── projections/
│   ├── session-state.ts
│   ├── available-choices.ts
│   └── analytics.ts
├── automation/
│   └── automatic-transitions.ts
├── conditions/
│   ├── resolver.ts
│   └── external-bridge.ts
└── __tests__/
    ├── graph-validation.test.ts
    ├── path-tests.test.ts
    └── timeline-tests.test.ts
```

---

## Appendix: Quick Reference

### Event Modeling Alignment

| Concept | Event Modeling Element | Color |
|---------|----------------------|-------|
| SelectChoice, StartSession | Command | Blue |
| NarrativeChoiceMade, NodeEntered | Event | Orange |
| PlayerNarrativeState | Read Model | Green |
| AutomaticTransitionProcessor | Automation | Blue arrows |
| NarrativeGraph | Reference Data | (External) |

### Key Principles Preserved

1. **Commands validated against graph** - Graph is reference data consulted during command handling
2. **Events are facts** - Record what happened, not computed state
3. **Projections derived** - All state rebuilt from events
4. **No hidden state** - Everything traceable through event history
5. **Automation through processors** - Not saga patterns
6. **Ruthless command validation** - Reject invalid before storing
7. **Graceful projection handling** - Handle unexpected data in projections