// ============================================================================
// SPACE FORTRESS - Game Events (Immutable Facts)
// ============================================================================
//
// Events are past-tense facts that have occurred. They are stored forever
// and never modified. All state changes flow through events.
//
// Naming convention: NOUN_PAST_TENSE_VERB (e.g., QUEST_ACCEPTED, CARD_GAINED)
// ============================================================================

import type {
  FactionId,
  Card,
  RoundResult,
  BattleOutcome,
  RoundOutcome,
  PostBattleDilemmaType,
  EndingType,
  ReputationStatus,
  GamePhase
} from './types'

// ----------------------------------------------------------------------------
// Base Event Structure
// ----------------------------------------------------------------------------

interface BaseEventData {
  timestamp: string
}

// ----------------------------------------------------------------------------
// Quest Events (6)
// ----------------------------------------------------------------------------

export interface QuestsGeneratedEvent {
  type: 'QUESTS_GENERATED'
  data: BaseEventData & {
    questIds: string[]
  }
}

export interface QuestViewedEvent {
  type: 'QUEST_VIEWED'
  data: BaseEventData & {
    questId: string
  }
}

export interface QuestAcceptedEvent {
  type: 'QUEST_ACCEPTED'
  data: BaseEventData & {
    questId: string
    factionId: FactionId
    initialBounty: number
    initialCardIds: string[]
  }
}

export interface QuestDeclinedEvent {
  type: 'QUEST_DECLINED'
  data: BaseEventData & {
    questId: string
    reason?: string
  }
}

export interface QuestCompletedEvent {
  type: 'QUEST_COMPLETED'
  data: BaseEventData & {
    questId: string
    outcome: 'completed' | 'full' | 'partial' | 'compromised'
    finalBounty: number
  }
}

export interface QuestFailedEvent {
  type: 'QUEST_FAILED'
  data: BaseEventData & {
    questId: string
    failurePoint: string
    reason: string
  }
}

// ----------------------------------------------------------------------------
// Narrative Events (3)
// ----------------------------------------------------------------------------

export interface DilemmaPresenedEvent {
  type: 'DILEMMA_PRESENTED'
  data: BaseEventData & {
    dilemmaId: string
    questId: string
  }
}

export interface ChoiceMadeEvent {
  type: 'CHOICE_MADE'
  data: BaseEventData & {
    dilemmaId: string
    choiceId: string
    questId: string
  }
}

export interface FlagSetEvent {
  type: 'FLAG_SET'
  data: BaseEventData & {
    flagName: string
    value: boolean
  }
}

// ----------------------------------------------------------------------------
// Alliance Events (7)
// ----------------------------------------------------------------------------

export interface AlliancePhaseStartedEvent {
  type: 'ALLIANCE_PHASE_STARTED'
  data: BaseEventData & {
    questId: string
    battleContext: string
    availableFactionIds: FactionId[]
  }
}

export interface AllianceTermsViewedEvent {
  type: 'ALLIANCE_TERMS_VIEWED'
  data: BaseEventData & {
    factionId: FactionId
  }
}

export interface AllianceFormedEvent {
  type: 'ALLIANCE_FORMED'
  data: BaseEventData & {
    factionId: FactionId
    bountyShare: number
    cardIdsProvided: string[]
    isSecret: boolean
  }
}

export interface AllianceRejectedEvent {
  type: 'ALLIANCE_REJECTED'
  data: BaseEventData & {
    factionId: FactionId
    reason?: string
  }
}

export interface AlliancesDeclinedEvent {
  type: 'ALLIANCES_DECLINED'
  data: BaseEventData & {
    questId: string
  }
}

export interface SecretAllianceFormedEvent {
  type: 'SECRET_ALLIANCE_FORMED'
  data: BaseEventData & {
    factionId: FactionId
    publicFactionId?: FactionId
    discoveryRisk: number
    cardIdsProvided: string[]
  }
}

export interface AllianceDiscoveredEvent {
  type: 'ALLIANCE_DISCOVERED'
  data: BaseEventData & {
    secretFactionId: FactionId
    discoveredByFactionId: FactionId
    reputationPenalty: number
  }
}

// ----------------------------------------------------------------------------
// Mediation Events (5)
// ----------------------------------------------------------------------------

export interface MediationStartedEvent {
  type: 'MEDIATION_STARTED'
  data: BaseEventData & {
    mediationId: string
    questId: string
    facilitatorFactionId: FactionId
    partyFactionIds: [FactionId, FactionId]
  }
}

export interface PositionViewedEvent {
  type: 'POSITION_VIEWED'
  data: BaseEventData & {
    factionId: FactionId
  }
}

export interface MediationLeanedEvent {
  type: 'MEDIATION_LEANED'
  data: BaseEventData & {
    towardFactionId: FactionId
    awayFromFactionId: FactionId
  }
}

export interface MediationCollapsedEvent {
  type: 'MEDIATION_COLLAPSED'
  data: BaseEventData & {
    reason: string
    battleTriggered: boolean
  }
}

export interface CompromiseAcceptedEvent {
  type: 'COMPROMISE_ACCEPTED'
  data: BaseEventData & {
    terms: string
    bountyModifier: number
  }
}

// ----------------------------------------------------------------------------
// Reputation Events (4)
// ----------------------------------------------------------------------------

export interface ReputationChangedEvent {
  type: 'REPUTATION_CHANGED'
  data: BaseEventData & {
    factionId: FactionId
    delta: number
    newValue: number
    source: 'quest' | 'choice' | 'alliance' | 'battle' | 'betrayal' | 'discovery'
  }
}

export interface ReputationThresholdCrossedEvent {
  type: 'REPUTATION_THRESHOLD_CROSSED'
  data: BaseEventData & {
    factionId: FactionId
    oldStatus: ReputationStatus
    newStatus: ReputationStatus
    direction: 'up' | 'down'
  }
}

export interface CardsUnlockedEvent {
  type: 'CARDS_UNLOCKED'
  data: BaseEventData & {
    factionId: FactionId
    cardIds: string[]
    reason: string
  }
}

export interface CardsLockedEvent {
  type: 'CARDS_LOCKED'
  data: BaseEventData & {
    factionId: FactionId
    cardIds: string[]
    reason: string
  }
}

// ----------------------------------------------------------------------------
// Card Events (2)
// ----------------------------------------------------------------------------

export interface CardGainedEvent {
  type: 'CARD_GAINED'
  data: BaseEventData & {
    cardId: string
    factionId: FactionId
    source: 'starter' | 'quest' | 'alliance' | 'choice' | 'unlock'
  }
}

export interface CardLostEvent {
  type: 'CARD_LOST'
  data: BaseEventData & {
    cardId: string
    factionId: FactionId
    reason: 'reputation' | 'betrayal' | 'choice' | 'penalty'
  }
}

// ----------------------------------------------------------------------------
// Battle Events (13)
// ----------------------------------------------------------------------------

export interface BattleTriggeredEvent {
  type: 'BATTLE_TRIGGERED'
  data: BaseEventData & {
    battleId: string
    questId: string
    context: string
    opponentType: string
    opponentFactionId: FactionId | 'scavengers' | 'pirates'
    difficulty: 'easy' | 'medium' | 'hard'
  }
}

export interface CardSelectedEvent {
  type: 'CARD_SELECTED'
  data: BaseEventData & {
    cardId: string
    battleId: string
  }
}

export interface CardDeselectedEvent {
  type: 'CARD_DESELECTED'
  data: BaseEventData & {
    cardId: string
    battleId: string
  }
}

export interface FleetCommittedEvent {
  type: 'FLEET_COMMITTED'
  data: BaseEventData & {
    battleId: string
    cardIds: string[]
  }
}

export interface CardPositionedEvent {
  type: 'CARD_POSITIONED'
  data: BaseEventData & {
    cardId: string
    position: number  // 1-5
    battleId: string
  }
}

export interface OrdersLockedEvent {
  type: 'ORDERS_LOCKED'
  data: BaseEventData & {
    battleId: string
    positions: string[]  // Card IDs in order [pos1, pos2, pos3, pos4, pos5]
  }
}

export interface BattleStartedEvent {
  type: 'BATTLE_STARTED'
  data: BaseEventData & {
    battleId: string
    playerCardIds: string[]
    opponentCards: Card[]
  }
}

export interface RoundStartedEvent {
  type: 'ROUND_STARTED'
  data: BaseEventData & {
    battleId: string
    roundNumber: number
  }
}

export interface CardsRevealedEvent {
  type: 'CARDS_REVEALED'
  data: BaseEventData & {
    battleId: string
    roundNumber: number
    playerCard: Card
    opponentCard: Card
  }
}

export interface InitiativeResolvedEvent {
  type: 'INITIATIVE_RESOLVED'
  data: BaseEventData & {
    battleId: string
    roundNumber: number
    firstStriker: 'player' | 'opponent' | 'simultaneous'
    playerAgility: number
    opponentAgility: number
  }
}

export interface AttackRolledEvent {
  type: 'ATTACK_ROLLED'
  data: BaseEventData & {
    battleId: string
    roundNumber: number
    attacker: 'player' | 'opponent'
    roll: number        // d20 result
    modifier: number    // attack stat
    total: number       // roll + modifier
    targetArmor: number
    targetNumber: number  // 10 + armor
    hit: boolean
  }
}

export interface RoundResolvedEvent {
  type: 'ROUND_RESOLVED'
  data: BaseEventData & {
    battleId: string
    roundNumber: number
    outcome: RoundOutcome
    playerCard: Card
    opponentCard: Card
    playerRoll: { base: number; modifier: number; total: number; hit: boolean }
    opponentRoll: { base: number; modifier: number; total: number; hit: boolean }
  }
}

export interface BattleResolvedEvent {
  type: 'BATTLE_RESOLVED'
  data: BaseEventData & {
    battleId: string
    outcome: BattleOutcome
    playerWins: number
    opponentWins: number
    draws: number
    roundsSummary: RoundResult[]
  }
}

// ----------------------------------------------------------------------------
// Consequence Events (3)
// ----------------------------------------------------------------------------

export interface BountyCalculatedEvent {
  type: 'BOUNTY_CALCULATED'
  data: BaseEventData & {
    battleId: string
    base: number
    shares: Array<{ factionId: FactionId; amount: number; reason: string }>
    modifiers: Array<{ amount: number; reason: string }>
    net: number
  }
}

export interface BountySharedEvent {
  type: 'BOUNTY_SHARED'
  data: BaseEventData & {
    factionId: FactionId
    amount: number
  }
}

export interface OutcomeAcknowledgedEvent {
  type: 'OUTCOME_ACKNOWLEDGED'
  data: BaseEventData & {
    battleId: string
  }
}

export interface BountyModifiedEvent {
  type: 'BOUNTY_MODIFIED'
  data: BaseEventData & {
    amount: number
    newValue: number
    source: 'choice' | 'alliance' | 'quest' | 'penalty'
    reason: string
  }
}

// ----------------------------------------------------------------------------
// Choice Consequence Events (2)
// ----------------------------------------------------------------------------

export interface ChoiceConsequencePresentedEvent {
  type: 'CHOICE_CONSEQUENCE_PRESENTED'
  data: BaseEventData & {
    dilemmaId: string
    choiceId: string
    questId: string
    choiceLabel: string
    narrativeText: string
    triggersNext: 'dilemma' | 'battle' | 'alliance' | 'mediation' | 'quest_complete'
  }
}

export interface ChoiceConsequenceAcknowledgedEvent {
  type: 'CHOICE_CONSEQUENCE_ACKNOWLEDGED'
  data: BaseEventData & {
    dilemmaId: string
    choiceId: string
  }
}

// ----------------------------------------------------------------------------
// Quest Summary Events (2)
// ----------------------------------------------------------------------------

export interface QuestSummaryPresentedEvent {
  type: 'QUEST_SUMMARY_PRESENTED'
  data: BaseEventData & {
    questId: string
    questTitle: string
    outcome: 'completed' | 'failed' | 'abandoned'
  }
}

export interface QuestSummaryAcknowledgedEvent {
  type: 'QUEST_SUMMARY_ACKNOWLEDGED'
  data: BaseEventData & {
    questId: string
  }
}

// ----------------------------------------------------------------------------
// Post-Battle Events (2)
// ----------------------------------------------------------------------------

export interface PostBattleDilemmaTriggeredEvent {
  type: 'POST_BATTLE_DILEMMA_TRIGGERED'
  data: BaseEventData & {
    battleId: string
    dilemmaId: string
    dilemmaType: PostBattleDilemmaType
    context: string
  }
}

export interface PostBattleChoiceMadeEvent {
  type: 'POST_BATTLE_CHOICE_MADE'
  data: BaseEventData & {
    dilemmaId: string
    choiceId: string
  }
}

// ----------------------------------------------------------------------------
// Game Lifecycle Events (4)
// ----------------------------------------------------------------------------

export interface GameStartedEvent {
  type: 'GAME_STARTED'
  data: BaseEventData & {
    playerId: string
    starterCardIds: string[]
  }
}

export interface GameEndTriggeredEvent {
  type: 'GAME_END_TRIGGERED'
  data: BaseEventData & {
    questsCompleted: number
    totalPlayTimeSeconds: number
  }
}

export interface EndingDeterminedEvent {
  type: 'ENDING_DETERMINED'
  data: BaseEventData & {
    endingType: EndingType
    title: string
    subtitle: string
    primaryFactionId?: FactionId
  }
}

export interface NewGameStartedEvent {
  type: 'NEW_GAME_STARTED'
  data: BaseEventData & {
    previousEndingType?: EndingType
  }
}

// ----------------------------------------------------------------------------
// Phase Transition Events
// ----------------------------------------------------------------------------

export interface PhaseChangedEvent {
  type: 'PHASE_CHANGED'
  data: BaseEventData & {
    fromPhase: GamePhase
    toPhase: GamePhase
  }
}

// ----------------------------------------------------------------------------
// Union Type: All Game Events
// ----------------------------------------------------------------------------

export type GameEvent =
  // Quest Events
  | QuestsGeneratedEvent
  | QuestViewedEvent
  | QuestAcceptedEvent
  | QuestDeclinedEvent
  | QuestCompletedEvent
  | QuestFailedEvent
  // Narrative Events
  | DilemmaPresenedEvent
  | ChoiceMadeEvent
  | FlagSetEvent
  // Choice Consequence Events
  | ChoiceConsequencePresentedEvent
  | ChoiceConsequenceAcknowledgedEvent
  // Quest Summary Events
  | QuestSummaryPresentedEvent
  | QuestSummaryAcknowledgedEvent
  // Alliance Events
  | AlliancePhaseStartedEvent
  | AllianceTermsViewedEvent
  | AllianceFormedEvent
  | AllianceRejectedEvent
  | AlliancesDeclinedEvent
  | SecretAllianceFormedEvent
  | AllianceDiscoveredEvent
  // Mediation Events
  | MediationStartedEvent
  | PositionViewedEvent
  | MediationLeanedEvent
  | MediationCollapsedEvent
  | CompromiseAcceptedEvent
  // Reputation Events
  | ReputationChangedEvent
  | ReputationThresholdCrossedEvent
  | CardsUnlockedEvent
  | CardsLockedEvent
  // Card Events
  | CardGainedEvent
  | CardLostEvent
  // Battle Events
  | BattleTriggeredEvent
  | CardSelectedEvent
  | CardDeselectedEvent
  | FleetCommittedEvent
  | CardPositionedEvent
  | OrdersLockedEvent
  | BattleStartedEvent
  | RoundStartedEvent
  | CardsRevealedEvent
  | InitiativeResolvedEvent
  | AttackRolledEvent
  | RoundResolvedEvent
  | BattleResolvedEvent
  // Consequence Events
  | BountyCalculatedEvent
  | BountySharedEvent
  | OutcomeAcknowledgedEvent
  | BountyModifiedEvent
  // Post-Battle Events
  | PostBattleDilemmaTriggeredEvent
  | PostBattleChoiceMadeEvent
  // Game Lifecycle Events
  | GameStartedEvent
  | GameEndTriggeredEvent
  | EndingDeterminedEvent
  | NewGameStartedEvent
  // Phase Events
  | PhaseChangedEvent

// ----------------------------------------------------------------------------
// Event Type Guards
// ----------------------------------------------------------------------------

export function isQuestEvent(event: GameEvent): boolean {
  return [
    'QUESTS_GENERATED',
    'QUEST_VIEWED',
    'QUEST_ACCEPTED',
    'QUEST_DECLINED',
    'QUEST_COMPLETED',
    'QUEST_FAILED'
  ].includes(event.type)
}

export function isBattleEvent(event: GameEvent): boolean {
  return [
    'BATTLE_TRIGGERED',
    'CARD_SELECTED',
    'CARD_DESELECTED',
    'FLEET_COMMITTED',
    'CARD_POSITIONED',
    'ORDERS_LOCKED',
    'BATTLE_STARTED',
    'ROUND_STARTED',
    'CARDS_REVEALED',
    'INITIATIVE_RESOLVED',
    'ATTACK_ROLLED',
    'ROUND_RESOLVED',
    'BATTLE_RESOLVED'
  ].includes(event.type)
}

export function isReputationEvent(event: GameEvent): boolean {
  return [
    'REPUTATION_CHANGED',
    'REPUTATION_THRESHOLD_CROSSED',
    'CARDS_UNLOCKED',
    'CARDS_LOCKED'
  ].includes(event.type)
}

// ----------------------------------------------------------------------------
// Event Factories (for type-safe event creation)
// ----------------------------------------------------------------------------

function createTimestamp(): string {
  return new Date().toISOString()
}

export const EventFactory = {
  gameStarted(playerId: string, starterCardIds: string[]): GameStartedEvent {
    return {
      type: 'GAME_STARTED',
      data: { timestamp: createTimestamp(), playerId, starterCardIds }
    }
  },

  questAccepted(
    questId: string,
    factionId: FactionId,
    initialBounty: number,
    initialCardIds: string[]
  ): QuestAcceptedEvent {
    return {
      type: 'QUEST_ACCEPTED',
      data: { timestamp: createTimestamp(), questId, factionId, initialBounty, initialCardIds }
    }
  },

  choiceMade(dilemmaId: string, choiceId: string, questId: string): ChoiceMadeEvent {
    return {
      type: 'CHOICE_MADE',
      data: { timestamp: createTimestamp(), dilemmaId, choiceId, questId }
    }
  },

  reputationChanged(
    factionId: FactionId,
    delta: number,
    newValue: number,
    source: ReputationChangedEvent['data']['source']
  ): ReputationChangedEvent {
    return {
      type: 'REPUTATION_CHANGED',
      data: { timestamp: createTimestamp(), factionId, delta, newValue, source }
    }
  },

  cardGained(
    cardId: string,
    factionId: FactionId,
    source: CardGainedEvent['data']['source']
  ): CardGainedEvent {
    return {
      type: 'CARD_GAINED',
      data: { timestamp: createTimestamp(), cardId, factionId, source }
    }
  },

  cardLost(
    cardId: string,
    factionId: FactionId,
    reason: CardLostEvent['data']['reason']
  ): CardLostEvent {
    return {
      type: 'CARD_LOST',
      data: { timestamp: createTimestamp(), cardId, factionId, reason }
    }
  },

  battleTriggered(
    battleId: string,
    questId: string,
    context: string,
    opponentType: string,
    opponentFactionId: FactionId | 'scavengers' | 'pirates',
    difficulty: 'easy' | 'medium' | 'hard'
  ): BattleTriggeredEvent {
    return {
      type: 'BATTLE_TRIGGERED',
      data: {
        timestamp: createTimestamp(),
        battleId,
        questId,
        context,
        opponentType,
        opponentFactionId,
        difficulty
      }
    }
  },

  phaseChanged(fromPhase: GamePhase, toPhase: GamePhase): PhaseChangedEvent {
    return {
      type: 'PHASE_CHANGED',
      data: { timestamp: createTimestamp(), fromPhase, toPhase }
    }
  }
}
