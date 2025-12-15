// ============================================================================
// SPACE FORTRESS - Decider (Business Logic)
// ============================================================================
//
// The decider validates commands against current state and generates events.
// This is where all game rules live.
//
// Pattern: Command + State → Event[]
// ============================================================================

import type { GameCommand } from './commands'
import type { GameEvent } from './events'
import type {
  GameState,
  FactionId,
  getReputationStatus,
  canFormAlliance,
  Card
} from './types'
import { getDilemmaById, getQuestById, getQuestFirstDilemma } from './content/quests'
import { getCardById, getAllianceCardIds } from './content/cards'
import { executeBattle } from './combat'
import { generateOpponentFleet } from './opponents'

// ----------------------------------------------------------------------------
// Error Types
// ----------------------------------------------------------------------------

export class InvalidCommandError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidCommandError'
  }
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

function timestamp(): string {
  return new Date().toISOString()
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Get reputation status from value
function getRepStatus(value: number): 'devoted' | 'friendly' | 'neutral' | 'unfriendly' | 'hostile' {
  if (value >= 75) return 'devoted'
  if (value >= 25) return 'friendly'
  if (value >= -24) return 'neutral'
  if (value >= -74) return 'unfriendly'
  return 'hostile'
}

// ----------------------------------------------------------------------------
// Main Decider Function
// ----------------------------------------------------------------------------

export function decide(command: GameCommand, state: GameState): GameEvent[] {
  switch (command.type) {
    // ========================================================================
    // Game Lifecycle
    // ========================================================================

    case 'START_GAME':
      return handleStartGame(command, state)

    case 'START_NEW_GAME':
      return handleStartNewGame(command, state)

    // ========================================================================
    // Quest Commands
    // ========================================================================

    case 'VIEW_QUEST_DETAILS':
      return handleViewQuestDetails(command, state)

    case 'ACCEPT_QUEST':
      return handleAcceptQuest(command, state)

    case 'DECLINE_QUEST':
      return handleDeclineQuest(command, state)

    // ========================================================================
    // Narrative Commands
    // ========================================================================

    case 'MAKE_CHOICE':
      return handleMakeChoice(command, state)

    case 'MAKE_POST_BATTLE_CHOICE':
      return handleMakePostBattleChoice(command, state)

    // ========================================================================
    // Alliance Commands
    // ========================================================================

    case 'VIEW_ALLIANCE_TERMS':
      return handleViewAllianceTerms(command, state)

    case 'FORM_ALLIANCE':
      return handleFormAlliance(command, state)

    case 'REJECT_ALLIANCE_TERMS':
      return handleRejectAllianceTerms(command, state)

    case 'DECLINE_ALL_ALLIANCES':
      return handleDeclineAllAlliances(command, state)

    case 'FINALIZE_ALLIANCES':
      return handleFinalizeAlliances(command, state)

    case 'FORM_SECRET_ALLIANCE':
      return handleFormSecretAlliance(command, state)

    // ========================================================================
    // Mediation Commands
    // ========================================================================

    case 'VIEW_POSITION':
      return handleViewPosition(command, state)

    case 'LEAN_TOWARD_FACTION':
      return handleLeanTowardFaction(command, state)

    case 'REFUSE_TO_LEAN':
      return handleRefuseToLean(command, state)

    case 'ACCEPT_COMPROMISE':
      return handleAcceptCompromise(command, state)

    // ========================================================================
    // Battle: Card Selection
    // ========================================================================

    case 'SELECT_CARD':
      return handleSelectCard(command, state)

    case 'DESELECT_CARD':
      return handleDeselectCard(command, state)

    case 'COMMIT_FLEET':
      return handleCommitFleet(command, state)

    // ========================================================================
    // Battle: Deployment
    // ========================================================================

    case 'SET_CARD_POSITION':
      return handleSetCardPosition(command, state)

    case 'LOCK_ORDERS':
      return handleLockOrders(command, state)

    // ========================================================================
    // Battle: Execution
    // ========================================================================

    case 'CONTINUE_BATTLE':
      return handleContinueBattle(command, state)

    // ========================================================================
    // Consequence
    // ========================================================================

    case 'ACKNOWLEDGE_OUTCOME':
      return handleAcknowledgeOutcome(command, state)

    case 'CONTINUE_TO_NEXT_PHASE':
      return handleContinueToNextPhase(command, state)

    // ========================================================================
    // Information Commands (mostly generate view events or none)
    // ========================================================================

    case 'VIEW_FACTION_DETAILS':
    case 'VIEW_CARD_DETAILS':
    case 'VIEW_CHOICE_HISTORY':
      // These are view-only, no state changes
      return []

    // ========================================================================
    // Navigation
    // ========================================================================

    case 'NAVIGATE_TO_SCREEN':
    case 'OPEN_MENU':
    case 'CLOSE_MENU':
      // UI-only, no game state changes
      return []

    // ========================================================================
    // Save/Load (handled separately by store)
    // ========================================================================

    case 'SAVE_GAME':
    case 'LOAD_GAME':
      // Handled by the store layer, not the decider
      return []

    default:
      throw new InvalidCommandError(`Unknown command type: ${(command as GameCommand).type}`)
  }
}

// ============================================================================
// Command Handlers
// ============================================================================

// ----------------------------------------------------------------------------
// Game Lifecycle Handlers
// ----------------------------------------------------------------------------

function handleStartGame(
  command: { type: 'START_GAME'; data: { playerId: string } },
  state: GameState
): GameEvent[] {
  if (state.gameStatus !== 'not_started') {
    throw new InvalidCommandError('Game already started')
  }

  const ts = timestamp()
  const starterCardIds = ['starter_scout', 'starter_freighter', 'starter_corvette']

  const events: GameEvent[] = [
    {
      type: 'GAME_STARTED',
      data: {
        timestamp: ts,
        playerId: command.data.playerId,
        starterCardIds
      }
    },
    {
      type: 'PHASE_CHANGED',
      data: {
        timestamp: ts,
        fromPhase: 'not_started',
        toPhase: 'quest_hub'
      }
    }
  ]

  // Grant starter cards
  const factions: FactionId[] = ['meridian', 'meridian', 'meridian']  // Starter cards are neutral/Meridian
  starterCardIds.forEach((cardId, i) => {
    events.push({
      type: 'CARD_GAINED',
      data: {
        timestamp: ts,
        cardId,
        factionId: factions[i],
        source: 'starter'
      }
    })
  })

  // Generate initial quests
  events.push({
    type: 'QUESTS_GENERATED',
    data: {
      timestamp: ts,
      questIds: ['quest_salvage_claim', 'quest_sanctuary_run', 'quest_brokers_gambit']
    }
  })

  return events
}

function handleStartNewGame(
  command: { type: 'START_NEW_GAME'; data: { playerId: string } },
  state: GameState
): GameEvent[] {
  const ts = timestamp()

  return [
    {
      type: 'NEW_GAME_STARTED',
      data: {
        timestamp: ts,
        previousEndingType: state.gameStatus === 'ended' ? undefined : undefined
      }
    }
  ]
}

// ----------------------------------------------------------------------------
// Quest Handlers
// ----------------------------------------------------------------------------

function handleViewQuestDetails(
  command: { type: 'VIEW_QUEST_DETAILS'; data: { questId: string } },
  state: GameState
): GameEvent[] {
  return [
    {
      type: 'QUEST_VIEWED',
      data: {
        timestamp: timestamp(),
        questId: command.data.questId
      }
    }
  ]
}

function handleAcceptQuest(
  command: { type: 'ACCEPT_QUEST'; data: { questId: string } },
  state: GameState
): GameEvent[] {
  if (state.gameStatus !== 'in_progress') {
    throw new InvalidCommandError('Game not in progress')
  }

  if (state.activeQuest) {
    throw new InvalidCommandError('Already have an active quest')
  }

  const questId = command.data.questId

  // Look up quest from content
  const quest = getQuestById(questId)
  if (!quest) {
    throw new InvalidCommandError(`Quest not found: ${questId}`)
  }

  // Get the first dilemma for this quest
  const firstDilemma = getQuestFirstDilemma(questId)
  if (!firstDilemma) {
    throw new InvalidCommandError(`Quest has no dilemmas: ${questId}`)
  }

  const ts = timestamp()

  const events: GameEvent[] = [
    {
      type: 'QUEST_ACCEPTED',
      data: {
        timestamp: ts,
        questId,
        factionId: quest.faction,
        initialBounty: quest.initialBounty,
        initialCardIds: quest.initialCards
      }
    },
    {
      type: 'PHASE_CHANGED',
      data: {
        timestamp: ts,
        fromPhase: 'quest_hub',
        toPhase: 'narrative'
      }
    },
    {
      type: 'DILEMMA_PRESENTED',
      data: {
        timestamp: ts,
        dilemmaId: firstDilemma.id,
        questId
      }
    }
  ]

  return events
}

function handleDeclineQuest(
  command: { type: 'DECLINE_QUEST'; data: { questId: string; reason?: string } },
  state: GameState
): GameEvent[] {
  return [
    {
      type: 'QUEST_DECLINED',
      data: {
        timestamp: timestamp(),
        questId: command.data.questId,
        reason: command.data.reason
      }
    }
  ]
}

// ----------------------------------------------------------------------------
// Narrative Handlers
// ----------------------------------------------------------------------------

function handleMakeChoice(
  command: { type: 'MAKE_CHOICE'; data: { dilemmaId: string; choiceId: string } },
  state: GameState
): GameEvent[] {
  if (state.gameStatus !== 'in_progress') {
    throw new InvalidCommandError('Game not in progress')
  }

  if (state.currentPhase !== 'narrative') {
    throw new InvalidCommandError('Not in narrative phase')
  }

  if (!state.activeQuest) {
    throw new InvalidCommandError('No active quest')
  }

  // Look up the dilemma and choice from content
  const dilemma = getDilemmaById(command.data.dilemmaId)
  if (!dilemma) {
    throw new InvalidCommandError(`Dilemma not found: ${command.data.dilemmaId}`)
  }

  const choice = dilemma.choices.find(c => c.id === command.data.choiceId)
  if (!choice) {
    throw new InvalidCommandError(`Choice not found: ${command.data.choiceId}`)
  }

  const ts = timestamp()
  const events: GameEvent[] = [
    {
      type: 'CHOICE_MADE',
      data: {
        timestamp: ts,
        dilemmaId: command.data.dilemmaId,
        choiceId: command.data.choiceId,
        questId: state.activeQuest.questId
      }
    }
  ]

  const consequences = choice.consequences

  // Apply reputation changes
  for (const repChange of consequences.reputationChanges) {
    const currentRep = state.reputation[repChange.faction]
    const newRep = Math.max(-100, Math.min(100, currentRep + repChange.delta))
    events.push({
      type: 'REPUTATION_CHANGED',
      data: {
        timestamp: ts,
        factionId: repChange.faction,
        delta: repChange.delta,
        newValue: newRep,
        source: 'choice'
      }
    })
  }

  // Apply cards gained
  for (const cardId of consequences.cardsGained) {
    const card = getCardById(cardId)
    if (card) {
      events.push({
        type: 'CARD_GAINED',
        data: {
          timestamp: ts,
          cardId: cardId,
          factionId: card.faction,
          source: 'choice'
        }
      })
    }
  }

  // Apply cards lost
  for (const cardId of consequences.cardsLost) {
    const card = getCardById(cardId)
    if (card) {
      events.push({
        type: 'CARD_LOST',
        data: {
          timestamp: ts,
          cardId: cardId,
          factionId: card.faction,
          reason: 'choice'
        }
      })
    }
  }

  // Apply bounty modifier
  if (consequences.bountyModifier && consequences.bountyModifier !== 0) {
    const newBounty = state.bounty + consequences.bountyModifier
    events.push({
      type: 'BOUNTY_MODIFIED',
      data: {
        timestamp: ts,
        amount: consequences.bountyModifier,
        newValue: Math.max(0, newBounty),
        source: 'choice',
        reason: `Choice: ${choice.label}`
      }
    })
  }

  // Set flags
  if (consequences.flags) {
    for (const [flagName, flagValue] of Object.entries(consequences.flags)) {
      events.push({
        type: 'FLAG_SET',
        data: {
          timestamp: ts,
          flagName,
          value: flagValue
        }
      })
    }
  }

  // Handle phase transitions based on triggers
  if (consequences.triggersBattle || consequences.triggersAlliance) {
    // Both battle and alliance triggers go to alliance phase first
    // Player must form alliance (or decline) before entering card selection
    events.push({
      type: 'PHASE_CHANGED',
      data: {
        timestamp: ts,
        fromPhase: 'narrative',
        toPhase: 'alliance'
      }
    })

    // Emit ALLIANCE_PHASE_STARTED so alliance screen knows the context
    events.push({
      type: 'ALLIANCE_PHASE_STARTED',
      data: {
        timestamp: ts,
        questId: state.activeQuest.questId,
        battleContext: consequences.triggersBattle
          ? 'Battle ahead - choose your allies wisely'
          : 'Form an alliance to strengthen your position',
        availableFactionIds: ['ironveil', 'ashfall', 'meridian', 'void_wardens', 'sundered_oath'] as FactionId[]
      }
    })
  } else if (consequences.triggersMediation) {
    events.push({
      type: 'PHASE_CHANGED',
      data: {
        timestamp: ts,
        fromPhase: 'narrative',
        toPhase: 'mediation'
      }
    })
  } else if (consequences.nextDilemmaId) {
    // Present the next dilemma (stay in narrative phase)
    events.push({
      type: 'DILEMMA_PRESENTED',
      data: {
        timestamp: ts,
        dilemmaId: consequences.nextDilemmaId,
        questId: state.activeQuest.questId
      }
    })
  } else {
    // No explicit next step - default to alliance phase to allow forming alliances before battle
    events.push({
      type: 'PHASE_CHANGED',
      data: {
        timestamp: ts,
        fromPhase: 'narrative',
        toPhase: 'alliance'
      }
    })
  }

  return events
}

function handleMakePostBattleChoice(
  command: { type: 'MAKE_POST_BATTLE_CHOICE'; data: { dilemmaId: string; choiceId: string } },
  state: GameState
): GameEvent[] {
  if (state.currentPhase !== 'post_battle_dilemma') {
    throw new InvalidCommandError('Not in post-battle dilemma phase')
  }

  const ts = timestamp()

  return [
    {
      type: 'POST_BATTLE_CHOICE_MADE',
      data: {
        timestamp: ts,
        dilemmaId: command.data.dilemmaId,
        choiceId: command.data.choiceId
      }
    }
  ]
}

// ----------------------------------------------------------------------------
// Alliance Handlers
// ----------------------------------------------------------------------------

function handleViewAllianceTerms(
  command: { type: 'VIEW_ALLIANCE_TERMS'; data: { factionId: FactionId } },
  state: GameState
): GameEvent[] {
  return [
    {
      type: 'ALLIANCE_TERMS_VIEWED',
      data: {
        timestamp: timestamp(),
        factionId: command.data.factionId
      }
    }
  ]
}

function handleFormAlliance(
  command: { type: 'FORM_ALLIANCE'; data: { factionId: FactionId } },
  state: GameState
): GameEvent[] {
  if (state.currentPhase !== 'alliance') {
    throw new InvalidCommandError('Not in alliance phase')
  }

  if (!state.activeQuest) {
    throw new InvalidCommandError('No active quest')
  }

  const factionRep = state.reputation[command.data.factionId] ?? 0
  const status = getRepStatus(factionRep)

  if (status === 'hostile') {
    throw new InvalidCommandError('Faction is hostile and will not ally with you')
  }

  const ts = timestamp()

  // Calculate bounty share based on reputation
  let bountyShare = 0.30  // Default 30%
  if (status === 'friendly') bountyShare = 0.25
  if (status === 'devoted') bountyShare = 0.15

  // Get alliance cards for this faction (2 cards per alliance)
  const allianceCardIds = getAllianceCardIds(command.data.factionId)

  const events: GameEvent[] = [
    {
      type: 'ALLIANCE_FORMED',
      data: {
        timestamp: ts,
        factionId: command.data.factionId,
        bountyShare,
        cardIdsProvided: allianceCardIds,
        isSecret: false
      }
    }
  ]

  // Emit CARD_GAINED events for each alliance card
  for (const cardId of allianceCardIds) {
    events.push({
      type: 'CARD_GAINED',
      data: {
        timestamp: ts,
        cardId,
        factionId: command.data.factionId,
        source: 'alliance'
      }
    })
  }

  // Stay in alliance phase - player can form more alliances
  // Use FINALIZE_ALLIANCES command to transition to card selection
  return events
}

function handleRejectAllianceTerms(
  command: { type: 'REJECT_ALLIANCE_TERMS'; data: { factionId: FactionId } },
  state: GameState
): GameEvent[] {
  return [
    {
      type: 'ALLIANCE_REJECTED',
      data: {
        timestamp: timestamp(),
        factionId: command.data.factionId
      }
    }
  ]
}

function handleDeclineAllAlliances(
  command: { type: 'DECLINE_ALL_ALLIANCES'; data: Record<string, never> },
  state: GameState
): GameEvent[] {
  if (!state.activeQuest) {
    throw new InvalidCommandError('No active quest')
  }

  // Validate minimum card requirement
  const MIN_BATTLE_CARDS = 5
  if (state.ownedCards.length < MIN_BATTLE_CARDS) {
    throw new InvalidCommandError(
      `Cannot proceed without allies. You have ${state.ownedCards.length} cards ` +
      `but battle requires ${MIN_BATTLE_CARDS}. Form an alliance to continue.`
    )
  }

  const ts = timestamp()
  const battleId = generateId('battle')

  return [
    {
      type: 'ALLIANCES_DECLINED',
      data: {
        timestamp: ts,
        questId: state.activeQuest.questId
      }
    },
    {
      type: 'BATTLE_TRIGGERED',
      data: {
        timestamp: ts,
        battleId,
        questId: state.activeQuest.questId,
        context: 'Going it alone - prepare for battle',
        opponentType: 'enemy_forces',
        opponentFactionId: 'scavengers',
        difficulty: 'medium'
      }
    },
    {
      type: 'PHASE_CHANGED',
      data: {
        timestamp: ts,
        fromPhase: 'alliance',
        toPhase: 'card_selection'
      }
    }
  ]
}

function handleFinalizeAlliances(
  command: { type: 'FINALIZE_ALLIANCES'; data: Record<string, never> },
  state: GameState
): GameEvent[] {
  if (state.currentPhase !== 'alliance') {
    throw new InvalidCommandError('Not in alliance phase')
  }

  if (!state.activeQuest) {
    throw new InvalidCommandError('No active quest')
  }

  // Validate minimum card requirement
  const MIN_BATTLE_CARDS = 5
  if (state.ownedCards.length < MIN_BATTLE_CARDS) {
    throw new InvalidCommandError(
      `Need ${MIN_BATTLE_CARDS} cards for battle but only have ${state.ownedCards.length}. Form more alliances to continue.`
    )
  }

  const ts = timestamp()
  const battleId = generateId('battle')

  return [
    {
      type: 'BATTLE_TRIGGERED',
      data: {
        timestamp: ts,
        battleId,
        questId: state.activeQuest.questId,
        context: 'Alliances finalized - prepare for battle',
        opponentType: 'enemy_forces',
        opponentFactionId: 'scavengers',
        difficulty: 'medium'
      }
    },
    {
      type: 'PHASE_CHANGED',
      data: {
        timestamp: ts,
        fromPhase: 'alliance',
        toPhase: 'card_selection'
      }
    }
  ]
}

function handleFormSecretAlliance(
  command: { type: 'FORM_SECRET_ALLIANCE'; data: { factionId: FactionId; publicFactionId?: FactionId } },
  state: GameState
): GameEvent[] {
  if (state.currentPhase !== 'alliance') {
    throw new InvalidCommandError('Not in alliance phase')
  }

  if (!state.activeQuest) {
    throw new InvalidCommandError('No active quest')
  }

  const ts = timestamp()
  const battleId = generateId('battle')

  return [
    {
      type: 'SECRET_ALLIANCE_FORMED',
      data: {
        timestamp: ts,
        factionId: command.data.factionId,
        publicFactionId: command.data.publicFactionId,
        discoveryRisk: 0.3,  // 30% chance of discovery
        cardIdsProvided: []
      }
    },
    {
      type: 'BATTLE_TRIGGERED',
      data: {
        timestamp: ts,
        battleId,
        questId: state.activeQuest.questId,
        context: 'Secret alliance formed - prepare for battle',
        opponentType: 'enemy_forces',
        opponentFactionId: 'scavengers',
        difficulty: 'medium'
      }
    },
    {
      type: 'PHASE_CHANGED',
      data: {
        timestamp: ts,
        fromPhase: 'alliance',
        toPhase: 'card_selection'
      }
    }
  ]
}

// ----------------------------------------------------------------------------
// Mediation Handlers
// ----------------------------------------------------------------------------

function handleViewPosition(
  command: { type: 'VIEW_POSITION'; data: { factionId: FactionId } },
  state: GameState
): GameEvent[] {
  return [
    {
      type: 'POSITION_VIEWED',
      data: {
        timestamp: timestamp(),
        factionId: command.data.factionId
      }
    }
  ]
}

function handleLeanTowardFaction(
  command: { type: 'LEAN_TOWARD_FACTION'; data: { towardFactionId: FactionId } },
  state: GameState
): GameEvent[] {
  if (state.currentPhase !== 'mediation') {
    throw new InvalidCommandError('Not in mediation phase')
  }

  // TODO: Determine the "away" faction from mediation content
  const awayFactionId: FactionId = command.data.towardFactionId === 'ironveil' ? 'ashfall' : 'ironveil'

  const ts = timestamp()

  return [
    {
      type: 'MEDIATION_LEANED',
      data: {
        timestamp: ts,
        towardFactionId: command.data.towardFactionId,
        awayFromFactionId: awayFactionId
      }
    }
  ]
}

function handleRefuseToLean(
  command: { type: 'REFUSE_TO_LEAN'; data: Record<string, never> },
  state: GameState
): GameEvent[] {
  if (state.currentPhase !== 'mediation') {
    throw new InvalidCommandError('Not in mediation phase')
  }

  const ts = timestamp()

  return [
    {
      type: 'MEDIATION_COLLAPSED',
      data: {
        timestamp: ts,
        reason: 'Player refused to lean toward either party',
        battleTriggered: true
      }
    },
    {
      type: 'PHASE_CHANGED',
      data: {
        timestamp: ts,
        fromPhase: 'mediation',
        toPhase: 'card_selection'
      }
    }
  ]
}

function handleAcceptCompromise(
  command: { type: 'ACCEPT_COMPROMISE'; data: Record<string, never> },
  state: GameState
): GameEvent[] {
  if (state.currentPhase !== 'mediation') {
    throw new InvalidCommandError('Not in mediation phase')
  }

  const ts = timestamp()

  return [
    {
      type: 'COMPROMISE_ACCEPTED',
      data: {
        timestamp: ts,
        terms: 'Diplomatic resolution reached',
        bountyModifier: 0.5  // Reduced bounty for diplomatic path
      }
    },
    {
      type: 'PHASE_CHANGED',
      data: {
        timestamp: ts,
        fromPhase: 'mediation',
        toPhase: 'consequence'
      }
    }
  ]
}

// ----------------------------------------------------------------------------
// Battle: Card Selection Handlers
// ----------------------------------------------------------------------------

function handleSelectCard(
  command: { type: 'SELECT_CARD'; data: { cardId: string } },
  state: GameState
): GameEvent[] {
  if (state.currentPhase !== 'card_selection') {
    throw new InvalidCommandError('Not in card selection phase')
  }

  if (!state.currentBattle) {
    throw new InvalidCommandError('No active battle')
  }

  if (state.currentBattle.selectedCardIds.length >= 5) {
    throw new InvalidCommandError('Already selected 5 cards')
  }

  if (state.currentBattle.selectedCardIds.includes(command.data.cardId)) {
    throw new InvalidCommandError('Card already selected')
  }

  // Verify card is owned and not locked
  const card = state.ownedCards.find(c => c.id === command.data.cardId)
  if (!card) {
    throw new InvalidCommandError('Card not owned')
  }
  if (card.isLocked) {
    throw new InvalidCommandError('Card is locked')
  }

  return [
    {
      type: 'CARD_SELECTED',
      data: {
        timestamp: timestamp(),
        cardId: command.data.cardId,
        battleId: state.currentBattle.battleId
      }
    }
  ]
}

function handleDeselectCard(
  command: { type: 'DESELECT_CARD'; data: { cardId: string } },
  state: GameState
): GameEvent[] {
  if (state.currentPhase !== 'card_selection') {
    throw new InvalidCommandError('Not in card selection phase')
  }

  if (!state.currentBattle) {
    throw new InvalidCommandError('No active battle')
  }

  if (!state.currentBattle.selectedCardIds.includes(command.data.cardId)) {
    throw new InvalidCommandError('Card not selected')
  }

  return [
    {
      type: 'CARD_DESELECTED',
      data: {
        timestamp: timestamp(),
        cardId: command.data.cardId,
        battleId: state.currentBattle.battleId
      }
    }
  ]
}

function handleCommitFleet(
  command: { type: 'COMMIT_FLEET'; data: { cardIds: string[] } },
  state: GameState
): GameEvent[] {
  if (state.currentPhase !== 'card_selection') {
    throw new InvalidCommandError('Not in card selection phase')
  }

  if (!state.currentBattle) {
    throw new InvalidCommandError('No active battle')
  }

  const cardIds = command.data.cardIds
  if (cardIds.length !== 5) {
    throw new InvalidCommandError('Must select exactly 5 cards')
  }

  // Validate that all cards are owned and not locked
  for (const cardId of cardIds) {
    const card = state.ownedCards.find(c => c.id === cardId)
    if (!card) {
      throw new InvalidCommandError(`Card not owned: ${cardId}`)
    }
    if (card.isLocked) {
      throw new InvalidCommandError(`Card is locked: ${cardId}`)
    }
  }

  const ts = timestamp()

  return [
    {
      type: 'FLEET_COMMITTED',
      data: {
        timestamp: ts,
        battleId: state.currentBattle.battleId,
        cardIds
      }
    },
    {
      type: 'PHASE_CHANGED',
      data: {
        timestamp: ts,
        fromPhase: 'card_selection',
        toPhase: 'deployment'
      }
    }
  ]
}

// ----------------------------------------------------------------------------
// Battle: Deployment Handlers
// ----------------------------------------------------------------------------

function handleSetCardPosition(
  command: { type: 'SET_CARD_POSITION'; data: { cardId: string; position: number } },
  state: GameState
): GameEvent[] {
  if (state.currentPhase !== 'deployment') {
    throw new InvalidCommandError('Not in deployment phase')
  }

  if (!state.currentBattle) {
    throw new InvalidCommandError('No active battle')
  }

  if (command.data.position < 1 || command.data.position > 5) {
    throw new InvalidCommandError('Position must be 1-5')
  }

  if (!state.currentBattle.selectedCardIds.includes(command.data.cardId)) {
    throw new InvalidCommandError('Card not in selected fleet')
  }

  return [
    {
      type: 'CARD_POSITIONED',
      data: {
        timestamp: timestamp(),
        cardId: command.data.cardId,
        position: command.data.position,
        battleId: state.currentBattle.battleId
      }
    }
  ]
}

function handleLockOrders(
  command: { type: 'LOCK_ORDERS'; data: Record<string, never> },
  state: GameState
): GameEvent[] {
  if (state.currentPhase !== 'deployment') {
    throw new InvalidCommandError('Not in deployment phase')
  }

  if (!state.currentBattle) {
    throw new InvalidCommandError('No active battle')
  }

  // Verify all 5 positions are filled
  const positions = state.currentBattle.positions
  if (positions.some(p => p === null)) {
    throw new InvalidCommandError('All 5 positions must be filled')
  }

  const ts = timestamp()
  const events: GameEvent[] = []

  // First emit ORDERS_LOCKED
  events.push({
    type: 'ORDERS_LOCKED',
    data: {
      timestamp: ts,
      battleId: state.currentBattle.battleId,
      positions: positions as string[]
    }
  })

  // Build player fleet from positions (order matters!)
  const playerFleet: Card[] = (positions as string[]).map(cardId => {
    const card = state.ownedCards.find(c => c.id === cardId)
    if (!card) {
      throw new InvalidCommandError(`Card not found in owned cards: ${cardId}`)
    }
    return {
      id: card.id,
      name: card.name,
      faction: card.faction,
      attack: card.attack,
      armor: card.armor,
      agility: card.agility
    }
  })

  // Generate opponent fleet based on battle context
  const opponentFleet = generateOpponentFleet({
    questId: state.currentBattle.questId || state.activeQuest?.questId || 'unknown',
    opponentType: state.currentBattle.opponentType || 'scavengers',
    difficulty: state.currentBattle.difficulty || 'medium'
  })

  // Execute the battle and generate all battle events
  const { events: battleEvents } = executeBattle(
    {
      battleId: state.currentBattle.battleId,
      questId: state.currentBattle.questId || state.activeQuest?.questId || 'unknown',
      context: state.currentBattle.context || 'Combat engagement',
      timestamp: ts
    },
    playerFleet,
    opponentFleet.cards
  )

  // Add all battle events
  events.push(...battleEvents)

  // Finally transition to battle phase
  events.push({
    type: 'PHASE_CHANGED',
    data: {
      timestamp: ts,
      fromPhase: 'deployment',
      toPhase: 'battle'
    }
  })

  return events
}

// ----------------------------------------------------------------------------
// Battle: Execution Handlers
// ----------------------------------------------------------------------------

function handleContinueBattle(
  command: { type: 'CONTINUE_BATTLE'; data: Record<string, never> },
  state: GameState
): GameEvent[] {
  // Battle execution is handled by the combat engine, not direct commands
  // This command is for UI flow (player clicks "Continue" to see next round)
  return []
}

// ----------------------------------------------------------------------------
// Consequence Handlers
// ----------------------------------------------------------------------------

function handleAcknowledgeOutcome(
  command: { type: 'ACKNOWLEDGE_OUTCOME'; data: Record<string, never> },
  state: GameState
): GameEvent[] {
  if (state.currentPhase !== 'consequence') {
    throw new InvalidCommandError('Not in consequence phase')
  }

  if (!state.currentBattle) {
    throw new InvalidCommandError('No battle to acknowledge')
  }

  return [
    {
      type: 'OUTCOME_ACKNOWLEDGED',
      data: {
        timestamp: timestamp(),
        battleId: state.currentBattle.battleId
      }
    }
  ]
}

function handleContinueToNextPhase(
  command: { type: 'CONTINUE_TO_NEXT_PHASE'; data: Record<string, never> },
  state: GameState
): GameEvent[] {
  // Determine next phase based on game state
  // This is context-dependent and would check quest progress, etc.
  const ts = timestamp()

  // Default: go back to narrative for next dilemma or quest hub
  return [
    {
      type: 'PHASE_CHANGED',
      data: {
        timestamp: ts,
        fromPhase: state.currentPhase,
        toPhase: 'narrative'  // Or 'quest_hub' if quest is complete
      }
    }
  ]
}
