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
  canFormAlliance
} from './types'

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

  // TODO: Look up quest from content, validate reputation requirement
  // For now, accept any quest
  const ts = timestamp()
  const questId = command.data.questId

  // Determine faction from quest ID (temporary logic)
  let factionId: FactionId = 'ironveil'
  if (questId.includes('sanctuary')) factionId = 'ashfall'
  if (questId.includes('broker')) factionId = 'meridian'

  const events: GameEvent[] = [
    {
      type: 'QUEST_ACCEPTED',
      data: {
        timestamp: ts,
        questId,
        factionId,
        initialBounty: 500,
        initialCardIds: []  // Will be populated from quest content
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
        dilemmaId: `${questId}_dilemma_1`,
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

  // TODO: Look up choice consequences from content and generate appropriate events
  // For now, this is a placeholder that would be expanded with actual content

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

  const events: GameEvent[] = [
    {
      type: 'ALLIANCE_FORMED',
      data: {
        timestamp: ts,
        factionId: command.data.factionId,
        bountyShare,
        cardIdsProvided: [],  // Would come from faction data
        isSecret: false
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

  const ts = timestamp()

  return [
    {
      type: 'ALLIANCES_DECLINED',
      data: {
        timestamp: ts,
        questId: state.activeQuest.questId
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

  const ts = timestamp()

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
  command: { type: 'COMMIT_FLEET'; data: Record<string, never> },
  state: GameState
): GameEvent[] {
  if (state.currentPhase !== 'card_selection') {
    throw new InvalidCommandError('Not in card selection phase')
  }

  if (!state.currentBattle) {
    throw new InvalidCommandError('No active battle')
  }

  if (state.currentBattle.selectedCardIds.length !== 5) {
    throw new InvalidCommandError('Must select exactly 5 cards')
  }

  const ts = timestamp()

  return [
    {
      type: 'FLEET_COMMITTED',
      data: {
        timestamp: ts,
        battleId: state.currentBattle.battleId,
        cardIds: state.currentBattle.selectedCardIds
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

  return [
    {
      type: 'ORDERS_LOCKED',
      data: {
        timestamp: ts,
        battleId: state.currentBattle.battleId,
        positions: positions as string[]
      }
    },
    {
      type: 'PHASE_CHANGED',
      data: {
        timestamp: ts,
        fromPhase: 'deployment',
        toPhase: 'battle'
      }
    }
  ]
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
