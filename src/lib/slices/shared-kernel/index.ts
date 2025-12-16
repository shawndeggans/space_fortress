// ============================================================================
// SHARED KERNEL - Public API
// ============================================================================
//
// This module exports all shared kernel components. Slices should import
// from this index rather than from individual files.
//
// USAGE:
// ```typescript
// import {
//   FactionId,
//   GamePhase,
//   GameEvent,
//   createEventBus
// } from '$lib/slices/shared-kernel'
// ```
// ============================================================================

// ----------------------------------------------------------------------------
// Core Domain Types
// ----------------------------------------------------------------------------

export {
  // Faction types
  type FactionId,
  type ReputationStatus,
  getReputationStatus,
  canFormAlliance,

  // Game phase
  type GamePhase,

  // Card types
  type Card,
  type OwnedCard,
  type CardSource,

  // Battle outcomes
  type BattleOutcome,
  type RoundOutcome,

  // Reputation
  type ReputationChange,

  // Event base
  type BaseEventData,
  createTimestamp,

  // Utilities
  type DeepPartial,
  type TypedEvent
} from './types'

// ----------------------------------------------------------------------------
// Event Types
// ----------------------------------------------------------------------------

export {
  // Quest events
  type QuestsGeneratedEvent,
  type QuestViewedEvent,
  type QuestAcceptedEvent,
  type QuestDeclinedEvent,
  type QuestCompletedEvent,
  type QuestFailedEvent,

  // Narrative events
  type DilemmaPresenedEvent,
  type ChoiceMadeEvent,
  type FlagSetEvent,

  // Choice consequence events
  type ChoiceConsequencePresentedEvent,
  type ChoiceConsequenceAcknowledgedEvent,

  // Quest summary events
  type QuestSummaryPresentedEvent,
  type QuestSummaryAcknowledgedEvent,

  // Alliance events
  type AlliancePhaseStartedEvent,
  type AllianceTermsViewedEvent,
  type AllianceFormedEvent,
  type AllianceRejectedEvent,
  type AlliancesDeclinedEvent,
  type AlliancesFinalizedEvent,
  type SecretAllianceFormedEvent,
  type AllianceDiscoveredEvent,

  // Mediation events
  type MediationStartedEvent,
  type PositionViewedEvent,
  type MediationLeanedEvent,
  type MediationCollapsedEvent,
  type CompromiseAcceptedEvent,

  // Reputation events
  type ReputationChangedEvent,
  type ReputationThresholdCrossedEvent,
  type CardsUnlockedEvent,
  type CardsLockedEvent,

  // Card events
  type CardGainedEvent,
  type CardLostEvent,

  // Battle events
  type BattleTriggeredEvent,
  type CardSelectedEvent,
  type CardDeselectedEvent,
  type FleetCommittedEvent,
  type CardPositionedEvent,
  type OrdersLockedEvent,
  type BattleStartedEvent,
  type RoundStartedEvent,
  type CardsRevealedEvent,
  type InitiativeResolvedEvent,
  type AttackRolledEvent,
  type RoundResolvedEvent,
  type RoundResult,
  type BattleResolvedEvent,

  // Consequence events
  type BountyCalculatedEvent,
  type BountySharedEvent,
  type OutcomeAcknowledgedEvent,
  type BountyModifiedEvent,

  // Post-battle events
  type PostBattleDilemmaType,
  type PostBattleDilemmaTriggeredEvent,
  type PostBattleChoiceMadeEvent,

  // Game lifecycle events
  type GameStartedEvent,
  type GameEndTriggeredEvent,
  type EndingType,
  type EndingDeterminedEvent,
  type NewGameStartedEvent,
  type GameEndedEvent,

  // Phase events
  type PhaseChangedEvent,

  // Union type
  type GameEvent,
  type GameEventType,

  // Type guards
  isQuestEvent,
  isBattleEvent,
  isReputationEvent,
  isAllianceEvent
} from './events'

// ----------------------------------------------------------------------------
// Event Bus
// ----------------------------------------------------------------------------

export {
  // Event bus factory
  createEventBus,
  type EventBus,
  type EventBusOptions,

  // Handler types
  type EventHandler,
  type Unsubscribe,

  // Global bus
  getGlobalEventBus,
  resetGlobalEventBus,

  // Projection helper
  createProjection,
  type Projection
} from './event-bus'
