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
import type { GameEvent, ChoiceConsequenceData } from './events'
import type {
  GameState,
  FactionId,
  TacticalBattleState
} from './types'
import { TACTICAL_BATTLE_CONFIG } from './types'
import { getDilemmaById, getQuestById, getQuestFirstDilemma } from './content/quests'
import { getCardById, getAllianceCardIds } from './content/cards'
import {
  handleSetCardPosition as sliceHandleSetCardPosition,
  handleLockOrders as sliceHandleLockOrders,
  type DeploymentState
} from '../slices/deployment'
import {
  handleLeanTowardFaction as sliceHandleLeanTowardFaction,
  handleRefuseToLean as sliceHandleRefuseToLean,
  handleAcceptCompromise as sliceHandleAcceptCompromise,
  type MediationState
} from '../slices/mediation'
import {
  handleAcknowledgeOutcome as sliceHandleAcknowledgeOutcome,
  handleContinueToNextPhase as sliceHandleContinueToNextPhase,
  type ConsequenceState
} from '../slices/consequence'
import {
  handleAcknowledgeChoiceConsequence as sliceHandleAcknowledgeChoiceConsequence,
  type ChoiceConsequenceState
} from '../slices/choice-consequence'
import {
  handleAcknowledgeQuestSummary as sliceHandleAcknowledgeQuestSummary,
  type QuestSummaryState
} from '../slices/quest-summary'

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
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

function toConsequenceState(state: GameState): ConsequenceState {
  let activeQuestInfo: ConsequenceState['activeQuest'] = null

  if (state.activeQuest) {
    const quest = getQuestById(state.activeQuest.questId)
    activeQuestInfo = {
      questId: state.activeQuest.questId,
      currentDilemmaIndex: state.activeQuest.currentDilemmaIndex,
      totalDilemmas: quest ? quest.dilemmaIds.length : 1
    }
  }

  return {
    currentPhase: state.currentPhase,
    currentBattle: state.currentBattle ? { battleId: state.currentBattle.battleId } : null,
    hasAcknowledgedOutcome: false, // This would be tracked in state if needed
    currentDilemmaId: state.currentDilemmaId,
    activeQuest: activeQuestInfo
  }
}

// Get reputation status from value
function getRepStatus(value: number): 'devoted' | 'friendly' | 'neutral' | 'unfriendly' | 'hostile' {
  if (value >= 75) return 'devoted'
  if (value >= 25) return 'friendly'
  if (value >= -24) return 'neutral'
  if (value >= -74) return 'unfriendly'
  return 'hostile'
}

function toChoiceConsequenceState(state: GameState): ChoiceConsequenceState {
  // Get triggersNext from pendingChoiceConsequence state (set by evolveState on CHOICE_CONSEQUENCE_PRESENTED)
  const choiceTriggersNext: ChoiceConsequenceState['choiceTriggersNext'] =
    state.pendingChoiceConsequence?.triggersNext ?? null

  let activeQuestInfo: ChoiceConsequenceState['activeQuest'] = null
  if (state.activeQuest) {
    const quest = getQuestById(state.activeQuest.questId)
    activeQuestInfo = {
      questId: state.activeQuest.questId,
      currentDilemmaIndex: state.activeQuest.currentDilemmaIndex,
      totalDilemmas: quest ? quest.dilemmaIds.length : 1
    }
  }

  return {
    currentPhase: state.currentPhase,
    activeQuest: activeQuestInfo,
    currentDilemmaId: state.currentDilemmaId,
    lastChoiceId: state.pendingChoiceConsequence?.choiceId ?? null,
    choiceTriggersNext
  }
}

function toQuestSummaryState(state: GameState): QuestSummaryState {
  let activeQuestInfo: QuestSummaryState['activeQuest'] = null
  if (state.activeQuest) {
    activeQuestInfo = {
      questId: state.activeQuest.questId,
      factionId: state.activeQuest.factionId
    }
  }

  return {
    currentPhase: state.currentPhase,
    activeQuest: activeQuestInfo,
    bounty: state.bounty,
    completedQuestsCount: state.completedQuests?.length ?? 0,
    totalQuests: 3  // Game has 3 quests total
  }
}

/**
 * Convert GameState to MediationState for slice handlers.
 * Maps the full GameState to the slice-specific state needed by mediation handlers.
 */
function toMediationState(state: GameState): MediationState {
  return {
    currentPhase: state.currentPhase,
    currentMediationId: state.currentMediationId,
    mediationParties: state.mediationParties,
    hasLeaned: state.hasLeaned,
    leanedToward: state.leanedToward,
    activeQuest: state.activeQuest ? { questId: state.activeQuest.questId } : null
  }
}

/**
 * Convert GameState to DeploymentState for slice handlers.
 * This adapter maps the full GameState to the minimal slice state needed.
 */
function toDeploymentState(state: GameState): DeploymentState {
  return {
    currentPhase: state.currentPhase,
    currentBattle: state.currentBattle ? {
      battleId: state.currentBattle.battleId,
      questId: state.currentBattle.questId,
      context: state.currentBattle.context,
      opponentType: state.currentBattle.opponentType,
      difficulty: state.currentBattle.difficulty,
      selectedCardIds: state.currentBattle.selectedCardIds,
      positions: state.currentBattle.positions
    } : null,
    activeQuest: state.activeQuest ? { questId: state.activeQuest.questId } : null,
    ownedCards: state.ownedCards
  }
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
      return sliceHandleLeanTowardFaction(command, toMediationState(state))

    case 'REFUSE_TO_LEAN':
      return sliceHandleRefuseToLean(command, toMediationState(state))

    case 'ACCEPT_COMPROMISE':
      return sliceHandleAcceptCompromise(command, toMediationState(state))

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
    // Battle: Deployment (delegated to deployment slice)
    // ========================================================================

    case 'SET_CARD_POSITION':
      return sliceHandleSetCardPosition(command, toDeploymentState(state))

    case 'LOCK_ORDERS':
      return sliceHandleLockOrders(command, toDeploymentState(state))

    // ========================================================================
    // Battle: Execution
    // ========================================================================

    case 'CONTINUE_BATTLE':
      return handleContinueBattle(command, state)

    // ========================================================================
    // Tactical Battle (Turn-Based Combat)
    // ========================================================================

    case 'START_TACTICAL_BATTLE':
      return handleStartTacticalBattle(command, state)

    case 'MULLIGAN_CARDS':
      return handleMulliganCards(command, state)

    case 'SKIP_MULLIGAN':
      return handleSkipMulligan(command, state)

    case 'DEPLOY_SHIP':
      return handleDeployShip(command, state)

    case 'ATTACK_WITH_SHIP':
      return handleAttackWithShip(command, state)

    case 'ACTIVATE_ABILITY':
      return handleActivateAbility(command, state)

    case 'MOVE_SHIP':
      return handleMoveShip(command, state)

    case 'DRAW_EXTRA_CARD':
      return handleDrawExtraCard(command, state)

    case 'END_TURN':
      return handleEndTurn(command, state)

    case 'USE_EMERGENCY_RESERVES':
      return handleUseEmergencyReserves(command, state)

    // ========================================================================
    // Consequence
    // ========================================================================

    case 'ACKNOWLEDGE_OUTCOME':
      return sliceHandleAcknowledgeOutcome(command, toConsequenceState(state))

    case 'CONTINUE_TO_NEXT_PHASE':
      return sliceHandleContinueToNextPhase(command, toConsequenceState(state))

    // ========================================================================
    // Choice Consequence (post-narrative choice feedback)
    // ========================================================================

    case 'ACKNOWLEDGE_CHOICE_CONSEQUENCE':
      return sliceHandleAcknowledgeChoiceConsequence(
        { type: 'ACKNOWLEDGE_CHOICE_CONSEQUENCE', data: {} },
        toChoiceConsequenceState(state)
      )

    // ========================================================================
    // Quest Summary (end of quest feedback)
    // ========================================================================

    case 'ACKNOWLEDGE_QUEST_SUMMARY':
      return sliceHandleAcknowledgeQuestSummary(
        { type: 'ACKNOWLEDGE_QUEST_SUMMARY', data: {} },
        toQuestSummaryState(state)
      )

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

  // Grant starter cards with full card data (fat events)
  starterCardIds.forEach((cardId) => {
    const card = getCardById(cardId)
    if (card) {
      events.push({
        type: 'CARD_GAINED',
        data: {
          timestamp: ts,
          cardId,
          factionId: card.faction,
          source: 'starter',
          name: card.name,
          attack: card.attack,
          defense: card.defense,
          hull: card.hull,
          agility: card.agility,
          energyCost: card.energyCost
        }
      })
    }
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
    }
  ]

  // Emit CARD_GAINED events for each initial quest card (fat events with card stats)
  for (const cardId of quest.initialCards) {
    const card = getCardById(cardId)
    if (card) {
      events.push({
        type: 'CARD_GAINED',
        data: {
          timestamp: ts,
          cardId,
          factionId: card.faction,
          source: 'quest',
          name: card.name,
          attack: card.attack,
          defense: card.defense,
          hull: card.hull,
          agility: card.agility,
          energyCost: card.energyCost
        }
      })
    }
  }

  events.push(
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
  )

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

  // Validate card loss won't drop below minimum (only if choice causes loss)
  const MIN_BATTLE_CARDS = 5
  const cardsToLose = consequences.cardsLost.filter(cardId =>
    state.ownedCards.some(c => c.id === cardId)
  ).length

  if (cardsToLose > 0) {
    const cardsToGain = consequences.cardsGained.length
    const netCardChange = cardsToGain - cardsToLose
    const projectedCardCount = state.ownedCards.length + netCardChange

    if (projectedCardCount < MIN_BATTLE_CARDS) {
      throw new InvalidCommandError(
        `This choice would leave you with ${projectedCardCount} cards, ` +
        `but you need at least ${MIN_BATTLE_CARDS} for battle. Choose differently.`
      )
    }
  }

  // Build consequence data for the CHOICE_CONSEQUENCE_PRESENTED event
  const consequenceData: ChoiceConsequenceData = {
    reputationChanges: [],
    cardsGained: [...consequences.cardsGained],
    cardsLost: [...consequences.cardsLost],
    bountyChange: null,
    flagsSet: consequences.flags ? Object.keys(consequences.flags).filter(k => consequences.flags![k]) : []
  }

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
    // Track for consequence display
    consequenceData.reputationChanges.push({
      factionId: repChange.faction,
      delta: repChange.delta,
      newValue: newRep
    })
  }

  // Apply cards gained (fat events with card stats)
  for (const cardId of consequences.cardsGained) {
    const card = getCardById(cardId)
    if (card) {
      events.push({
        type: 'CARD_GAINED',
        data: {
          timestamp: ts,
          cardId: cardId,
          factionId: card.faction,
          source: 'choice',
          name: card.name,
          attack: card.attack,
          defense: card.defense,
          hull: card.hull,
          agility: card.agility,
          energyCost: card.energyCost
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
    const newBounty = Math.max(0, state.bounty + consequences.bountyModifier)
    events.push({
      type: 'BOUNTY_MODIFIED',
      data: {
        timestamp: ts,
        amount: consequences.bountyModifier,
        newValue: newBounty,
        source: 'choice',
        reason: `Choice: ${choice.label}`
      }
    })
    // Track for consequence display
    consequenceData.bountyChange = {
      amount: consequences.bountyModifier,
      newValue: newBounty
    }
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

  // Determine what triggers next (for choice consequence screen)
  let triggersNext: 'dilemma' | 'battle' | 'alliance' | 'mediation' | 'quest_complete' = 'dilemma'

  if (consequences.triggersBattle) {
    triggersNext = 'battle'
  } else if (consequences.triggersAlliance) {
    triggersNext = 'alliance'
  } else if (consequences.triggersMediation) {
    triggersNext = 'mediation'
  } else if (consequences.nextDilemmaId) {
    triggersNext = 'dilemma'
  } else {
    // Check if this is the final dilemma
    const quest = getQuestById(state.activeQuest.questId)
    const isLastDilemma = quest
      ? quest.dilemmaIds.indexOf(command.data.dilemmaId) === quest.dilemmaIds.length - 1
      : true

    if (isLastDilemma) {
      triggersNext = 'quest_complete'
    } else {
      // Default to alliance if no next dilemma specified
      triggersNext = 'alliance'
    }
  }

  // Use choice-specific narrative if available, otherwise generate from templates
  const narrativeText = consequences.narrativeText || generateNarrativeText(consequences, triggersNext)

  // Emit CHOICE_CONSEQUENCE_PRESENTED event
  events.push({
    type: 'CHOICE_CONSEQUENCE_PRESENTED',
    data: {
      timestamp: ts,
      dilemmaId: command.data.dilemmaId,
      choiceId: command.data.choiceId,
      questId: state.activeQuest.questId,
      choiceLabel: choice.label,
      narrativeText,
      triggersNext,
      consequences: consequenceData
    }
  })

  // Transition to choice_consequence phase
  events.push({
    type: 'PHASE_CHANGED',
    data: {
      timestamp: ts,
      fromPhase: 'narrative',
      toPhase: 'choice_consequence'
    }
  })

  return events
}

// Helper to generate narrative text for consequence screen
function generateNarrativeText(
  consequences: { reputationChanges: Array<{ faction: FactionId; delta: number }>; bountyModifier?: number },
  triggersNext: string
): string {
  const templates: Record<string, string[]> = {
    positive_rep: [
      'Your decision strengthens old bonds and forges new alliances.',
      'Word of your actions spreads quickly through the sector.',
      'Your reputation precedes you now.',
    ],
    negative_rep: [
      'Some doors close as others open.',
      'Your choice will not be forgotten.',
      'The consequences of your decision ripple through the void.',
    ],
    bounty_gain: [
      'Your coffers grow heavier with credits.',
      'A profitable outcome, though profit is not everything.',
    ],
    bounty_loss: [
      'Credits flow from your account, but some things are worth more than money.',
      'The cost is steep, but you made your choice.',
    ],
    battle_ahead: [
      'Steel yourself. Conflict awaits beyond the next jump.',
      'The path ahead leads through fire and fury.',
    ],
    mediation_ahead: [
      'A delicate negotiation lies ahead. Choose your words carefully.',
      'Diplomacy may yet prevail, if you can find common ground.',
    ],
    quest_complete: [
      'Your quest nears its conclusion. The sector will remember this.',
      'The final threads of this tale are weaving together.',
    ],
    default: [
      'Your choice echoes through the void...',
      'The consequences of your decision unfold.',
      'What comes next remains to be seen.',
    ]
  }

  let category = 'default'

  if (triggersNext === 'battle') {
    category = 'battle_ahead'
  } else if (triggersNext === 'mediation') {
    category = 'mediation_ahead'
  } else if (triggersNext === 'quest_complete') {
    category = 'quest_complete'
  } else if (consequences.reputationChanges.length > 0) {
    const netRep = consequences.reputationChanges.reduce((sum, r) => sum + r.delta, 0)
    category = netRep >= 0 ? 'positive_rep' : 'negative_rep'
  } else if (consequences.bountyModifier) {
    category = consequences.bountyModifier > 0 ? 'bounty_gain' : 'bounty_loss'
  }

  const options = templates[category]
  return options[Math.floor(Math.random() * options.length)]
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

  // Emit CARD_GAINED events for each alliance card (fat events with card stats)
  for (const cardId of allianceCardIds) {
    const card = getCardById(cardId)
    if (card) {
      events.push({
        type: 'CARD_GAINED',
        data: {
          timestamp: ts,
          cardId,
          factionId: card.faction,
          source: 'alliance',
          name: card.name,
          attack: card.attack,
          defense: card.defense,
          hull: card.hull,
          agility: card.agility,
          energyCost: card.energyCost
        }
      })
    }
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
// Battle: Execution Handlers
// ----------------------------------------------------------------------------

function handleContinueBattle(
  _command: { type: 'CONTINUE_BATTLE'; data: Record<string, never> },
  _state: GameState
): GameEvent[] {
  // Battle execution is handled by the combat engine, not direct commands
  // This command is for UI flow (player clicks "Continue" to see next round)
  return []
}

// ----------------------------------------------------------------------------
// Tactical Battle Handlers (Turn-Based Combat)
// ----------------------------------------------------------------------------

/**
 * Calculate total agility from a list of card IDs
 */
function calculateTotalAgility(cardIds: string[]): number {
  return cardIds.reduce((total, cardId) => {
    const card = getCardById(cardId)
    return total + (card?.agility ?? 0)
  }, 0)
}

/**
 * Determine first player based on fleet agility
 */
function determineInitiative(
  playerCardIds: string[],
  opponentCardIds: string[]
): { firstPlayer: 'player' | 'opponent'; reason: 'agility' | 'tiebreaker' } {
  const playerAgility = calculateTotalAgility(playerCardIds)
  const opponentAgility = calculateTotalAgility(opponentCardIds)

  if (playerAgility > opponentAgility) {
    return { firstPlayer: 'player', reason: 'agility' }
  } else if (opponentAgility > playerAgility) {
    return { firstPlayer: 'opponent', reason: 'agility' }
  } else {
    // Tiebreaker: random (for now, favor player)
    return { firstPlayer: 'player', reason: 'tiebreaker' }
  }
}

/**
 * Generate opponent deck based on difficulty and faction
 */
function generateOpponentDeck(
  factionId: FactionId | 'scavengers' | 'pirates',
  difficulty: 'easy' | 'medium' | 'hard'
): string[] {
  // For now, generate a basic opponent deck
  // In a full implementation, this would pull from faction-specific card pools
  const baseDeck = [
    'enemy_fighter_1',
    'enemy_fighter_2',
    'enemy_frigate_1',
    'enemy_cruiser_1',
    'enemy_support_1',
    'enemy_fighter_3',
    'enemy_frigate_2',
    'enemy_cruiser_2'
  ]

  // Harder difficulties get more cards
  if (difficulty === 'hard') {
    baseDeck.push('enemy_battleship_1', 'enemy_battleship_2')
  } else if (difficulty === 'medium') {
    baseDeck.push('enemy_battleship_1')
  }

  return baseDeck.slice(0, TACTICAL_BATTLE_CONFIG.deckSize.max)
}

function handleStartTacticalBattle(
  command: { type: 'START_TACTICAL_BATTLE'; data: { deckCardIds: string[] } },
  state: GameState
): GameEvent[] {
  if (state.currentPhase !== 'card_selection') {
    throw new InvalidCommandError('Not in card selection phase')
  }

  if (!state.activeQuest) {
    throw new InvalidCommandError('No active quest')
  }

  const deckCardIds = command.data.deckCardIds

  // Validate deck size
  if (deckCardIds.length < TACTICAL_BATTLE_CONFIG.deckSize.min) {
    throw new InvalidCommandError(
      `Deck must have at least ${TACTICAL_BATTLE_CONFIG.deckSize.min} cards`
    )
  }
  if (deckCardIds.length > TACTICAL_BATTLE_CONFIG.deckSize.max) {
    throw new InvalidCommandError(
      `Deck can have at most ${TACTICAL_BATTLE_CONFIG.deckSize.max} cards`
    )
  }

  // Validate all cards are owned and not locked
  for (const cardId of deckCardIds) {
    const card = state.ownedCards.find(c => c.id === cardId)
    if (!card) {
      throw new InvalidCommandError(`Card not owned: ${cardId}`)
    }
    if (card.isLocked) {
      throw new InvalidCommandError(`Card is locked: ${cardId}`)
    }
  }

  const ts = timestamp()
  const battleId = generateId('tactical_battle')

  // Get opponent info from current battle context if available
  const opponentFactionId = state.currentBattle?.opponentFactionId ?? 'scavengers'
  const difficulty = state.currentBattle?.difficulty ?? 'medium'
  const context = state.currentBattle?.context ?? 'Tactical engagement'
  const opponentName = opponentFactionId === 'scavengers' ? 'Scavenger Fleet' :
                       opponentFactionId === 'pirates' ? 'Pirate Armada' :
                       `${opponentFactionId.charAt(0).toUpperCase() + opponentFactionId.slice(1)} Forces`

  // Generate opponent deck
  const opponentDeckCardIds = generateOpponentDeck(opponentFactionId, difficulty)

  // Determine initiative
  const initiative = determineInitiative(deckCardIds, opponentDeckCardIds)

  // Calculate flagship hull based on difficulty
  const difficultyModifier = difficulty === 'easy' ? 0 : difficulty === 'medium' ? 1 : 2
  const playerFlagshipHull = TACTICAL_BATTLE_CONFIG.baseFlagshipHull
  const opponentFlagshipHull = TACTICAL_BATTLE_CONFIG.baseFlagshipHull +
    (difficultyModifier * TACTICAL_BATTLE_CONFIG.flagshipHullPerDifficulty)

  const events: GameEvent[] = [
    {
      type: 'TACTICAL_BATTLE_STARTED',
      data: {
        timestamp: ts,
        battleId,
        questId: state.activeQuest.questId,
        context,
        playerDeckCardIds: deckCardIds,
        opponentDeckCardIds,
        opponentName,
        opponentFactionId,
        difficulty,
        playerFlagshipHull,
        opponentFlagshipHull,
        firstPlayer: initiative.firstPlayer,
        initiativeReason: initiative.reason
      }
    }
  ]

  // Draw starting hands (4 cards each)
  const shuffledPlayerDeck = [...deckCardIds].sort(() => Math.random() - 0.5)
  const shuffledOpponentDeck = [...opponentDeckCardIds].sort(() => Math.random() - 0.5)

  for (let i = 0; i < TACTICAL_BATTLE_CONFIG.startingHandSize; i++) {
    if (shuffledPlayerDeck[i]) {
      events.push({
        type: 'TACTICAL_CARD_DRAWN',
        data: {
          timestamp: ts,
          battleId,
          player: 'player',
          cardId: shuffledPlayerDeck[i],
          deckRemaining: shuffledPlayerDeck.length - i - 1
        }
      })
    }
    if (shuffledOpponentDeck[i]) {
      events.push({
        type: 'TACTICAL_CARD_DRAWN',
        data: {
          timestamp: ts,
          battleId,
          player: 'opponent',
          cardId: shuffledOpponentDeck[i],
          deckRemaining: shuffledOpponentDeck.length - i - 1
        }
      })
    }
  }

  return events
}

function handleMulliganCards(
  command: { type: 'MULLIGAN_CARDS'; data: { cardIdsToRedraw: string[] } },
  state: GameState
): GameEvent[] {
  if (!state.currentTacticalBattle) {
    throw new InvalidCommandError('No tactical battle in progress')
  }

  if (state.currentTacticalBattle.phase !== 'mulligan') {
    throw new InvalidCommandError('Not in mulligan phase')
  }

  const battle = state.currentTacticalBattle
  const cardIdsToRedraw = command.data.cardIdsToRedraw

  // Validate cards are in hand
  for (const cardId of cardIdsToRedraw) {
    if (!battle.player.hand.includes(cardId)) {
      throw new InvalidCommandError(`Card not in hand: ${cardId}`)
    }
  }

  const ts = timestamp()
  const events: GameEvent[] = []

  // Discard the cards to be redrawn
  for (const cardId of cardIdsToRedraw) {
    events.push({
      type: 'TACTICAL_CARD_DISCARDED',
      data: {
        timestamp: ts,
        battleId: battle.battleId,
        player: 'player',
        cardId,
        reason: 'mulligan'
      }
    })
  }

  // Draw new cards from deck
  const deck = battle.player.deck.filter(id => !battle.player.hand.includes(id))
  for (let i = 0; i < cardIdsToRedraw.length && i < deck.length; i++) {
    events.push({
      type: 'TACTICAL_CARD_DRAWN',
      data: {
        timestamp: ts,
        battleId: battle.battleId,
        player: 'player',
        cardId: deck[i],
        deckRemaining: deck.length - i - 1
      }
    })
  }

  // Mark mulligan complete
  events.push({
    type: 'MULLIGAN_COMPLETED',
    data: {
      timestamp: ts,
      battleId: battle.battleId,
      player: 'player',
      cardsRedrawn: cardIdsToRedraw.length
    }
  })

  // Start first turn if both players have completed mulligan
  events.push(...startFirstTurn(battle, ts))

  return events
}

function handleSkipMulligan(
  command: { type: 'SKIP_MULLIGAN'; data: Record<string, never> },
  state: GameState
): GameEvent[] {
  if (!state.currentTacticalBattle) {
    throw new InvalidCommandError('No tactical battle in progress')
  }

  if (state.currentTacticalBattle.phase !== 'mulligan') {
    throw new InvalidCommandError('Not in mulligan phase')
  }

  const battle = state.currentTacticalBattle
  const ts = timestamp()

  const events: GameEvent[] = [
    {
      type: 'MULLIGAN_COMPLETED',
      data: {
        timestamp: ts,
        battleId: battle.battleId,
        player: 'player',
        cardsRedrawn: 0
      }
    }
  ]

  // Start first turn
  events.push(...startFirstTurn(battle, ts))

  return events
}

/**
 * Helper to start the first turn after mulligan
 */
function startFirstTurn(battle: TacticalBattleState, ts: string): GameEvent[] {
  const firstPlayer = battle.initiative.firstPlayer
  const startingEnergy = TACTICAL_BATTLE_CONFIG.startingMaxEnergy

  return [
    {
      type: 'TACTICAL_TURN_STARTED',
      data: {
        timestamp: ts,
        battleId: battle.battleId,
        turnNumber: 1,
        activePlayer: firstPlayer,
        energyGained: startingEnergy,
        newEnergyTotal: startingEnergy
      }
    }
  ]
}

function handleDeployShip(
  command: { type: 'DEPLOY_SHIP'; data: { cardId: string; position: number } },
  state: GameState
): GameEvent[] {
  if (!state.currentTacticalBattle) {
    throw new InvalidCommandError('No tactical battle in progress')
  }

  const battle = state.currentTacticalBattle

  if (battle.phase !== 'playing') {
    throw new InvalidCommandError('Battle is not in playing phase')
  }

  if (battle.activePlayer !== 'player') {
    throw new InvalidCommandError('Not your turn')
  }

  const { cardId, position } = command.data

  // Validate position
  if (position < 1 || position > 5) {
    throw new InvalidCommandError('Invalid position (must be 1-5)')
  }

  // Validate card is in hand
  if (!battle.player.hand.includes(cardId)) {
    throw new InvalidCommandError('Card not in hand')
  }

  // Validate position is empty
  if (battle.player.battlefield[position - 1] !== null) {
    throw new InvalidCommandError('Position already occupied')
  }

  // Get card and validate energy cost
  const card = getCardById(cardId)
  if (!card) {
    throw new InvalidCommandError(`Card not found: ${cardId}`)
  }

  if (battle.player.energy.current < card.energyCost) {
    throw new InvalidCommandError(`Not enough energy (need ${card.energyCost}, have ${battle.player.energy.current})`)
  }

  const ts = timestamp()
  const newEnergy = battle.player.energy.current - card.energyCost

  return [
    {
      type: 'ENERGY_SPENT',
      data: {
        timestamp: ts,
        battleId: battle.battleId,
        player: 'player',
        amount: card.energyCost,
        newTotal: newEnergy,
        action: 'deploy'
      }
    },
    {
      type: 'SHIP_DEPLOYED',
      data: {
        timestamp: ts,
        battleId: battle.battleId,
        player: 'player',
        cardId,
        position,
        energyCost: card.energyCost
      }
    }
  ]
}

function handleAttackWithShip(
  command: { type: 'ATTACK_WITH_SHIP'; data: { attackerCardId: string; targetPosition?: number } },
  state: GameState
): GameEvent[] {
  if (!state.currentTacticalBattle) {
    throw new InvalidCommandError('No tactical battle in progress')
  }

  const battle = state.currentTacticalBattle

  if (battle.phase !== 'playing') {
    throw new InvalidCommandError('Battle is not in playing phase')
  }

  if (battle.activePlayer !== 'player') {
    throw new InvalidCommandError('Not your turn')
  }

  const { attackerCardId, targetPosition } = command.data

  // Find attacker on battlefield
  const attackerShip = battle.player.battlefield.find(
    ship => ship && ship.cardId === attackerCardId
  )
  if (!attackerShip) {
    throw new InvalidCommandError('Attacker not found on battlefield')
  }

  if (attackerShip.isExhausted) {
    throw new InvalidCommandError('Ship is exhausted and cannot attack')
  }

  const ts = timestamp()
  const events: GameEvent[] = []

  // Determine target
  let targetId: string
  let targetPlayer: 'player' | 'opponent' = 'opponent'
  let damageAmount = attackerShip.card.attack

  if (targetPosition !== undefined) {
    // Attacking a specific position
    const targetShip = battle.opponent.battlefield[targetPosition - 1]
    if (!targetShip) {
      // No ship at that position - check if any ships blocking
      const hasBlockers = battle.opponent.battlefield.some(ship => ship !== null)
      if (hasBlockers) {
        throw new InvalidCommandError('Cannot attack empty position while enemy ships are present')
      }
      // Attack flagship directly
      targetId = 'flagship'
    } else {
      targetId = targetShip.cardId
    }
  } else {
    // Auto-target: opposite position, or first enemy ship, or flagship
    const oppositeShip = battle.opponent.battlefield[attackerShip.position - 1]
    if (oppositeShip) {
      targetId = oppositeShip.cardId
    } else {
      const firstEnemyShip = battle.opponent.battlefield.find(ship => ship !== null)
      if (firstEnemyShip) {
        targetId = firstEnemyShip.cardId
      } else {
        targetId = 'flagship'
      }
    }
  }

  // Record the attack
  events.push({
    type: 'SHIP_ATTACKED',
    data: {
      timestamp: ts,
      battleId: battle.battleId,
      attackerId: attackerCardId,
      attackerPlayer: 'player',
      targetId,
      targetPlayer
    }
  })

  // Calculate and apply damage
  if (targetId === 'flagship') {
    const newHull = battle.opponent.flagship.currentHull - damageAmount
    events.push({
      type: 'DAMAGE_DEALT',
      data: {
        timestamp: ts,
        battleId: battle.battleId,
        sourceId: attackerCardId,
        targetId: 'flagship',
        targetPlayer,
        rawDamage: damageAmount,
        defenseReduction: 0,
        finalDamage: damageAmount,
        targetNewHull: Math.max(0, newHull),
        damageType: 'attack'
      }
    })

    if (newHull <= 0) {
      events.push({
        type: 'FLAGSHIP_DAMAGED',
        data: {
          timestamp: ts,
          battleId: battle.battleId,
          player: targetPlayer,
          amount: damageAmount,
          newHull: 0,
          source: attackerCardId
        }
      })
      events.push({
        type: 'FLAGSHIP_DESTROYED',
        data: {
          timestamp: ts,
          battleId: battle.battleId,
          player: targetPlayer,
          destroyedBy: attackerCardId
        }
      })
      // Battle resolved - player wins
      events.push({
        type: 'TACTICAL_BATTLE_RESOLVED',
        data: {
          timestamp: ts,
          battleId: battle.battleId,
          winner: 'player',
          victoryCondition: 'flagship_destroyed',
          turnsPlayed: battle.turnNumber,
          playerFinalHull: battle.player.flagship.currentHull,
          opponentFinalHull: 0,
          playerShipsDestroyed: 0, // Would need to track this
          opponentShipsDestroyed: 0 // Would need to track this
        }
      })
    }
  } else {
    // Attacking a ship
    const targetShipIndex = battle.opponent.battlefield.findIndex(
      ship => ship && ship.cardId === targetId
    )
    const targetShip = battle.opponent.battlefield[targetShipIndex]
    if (targetShip) {
      const newHull = targetShip.currentHull - damageAmount
      events.push({
        type: 'DAMAGE_DEALT',
        data: {
          timestamp: ts,
          battleId: battle.battleId,
          sourceId: attackerCardId,
          targetId,
          targetPlayer,
          rawDamage: damageAmount,
          defenseReduction: 0,
          finalDamage: damageAmount,
          targetNewHull: Math.max(0, newHull),
          damageType: 'attack'
        }
      })

      if (newHull <= 0) {
        events.push({
          type: 'SHIP_DESTROYED',
          data: {
            timestamp: ts,
            battleId: battle.battleId,
            cardId: targetId,
            owner: targetPlayer,
            position: targetShip.position,
            destroyedBy: attackerCardId
          }
        })
      }
    }
  }

  return events
}

function handleActivateAbility(
  command: { type: 'ACTIVATE_ABILITY'; data: { cardId: string; abilityId: string; targetId?: string } },
  state: GameState
): GameEvent[] {
  if (!state.currentTacticalBattle) {
    throw new InvalidCommandError('No tactical battle in progress')
  }

  const battle = state.currentTacticalBattle

  if (battle.phase !== 'playing') {
    throw new InvalidCommandError('Battle is not in playing phase')
  }

  if (battle.activePlayer !== 'player') {
    throw new InvalidCommandError('Not your turn')
  }

  // Find ship on battlefield
  const ship = battle.player.battlefield.find(
    s => s && s.cardId === command.data.cardId
  )
  if (!ship) {
    throw new InvalidCommandError('Ship not found on battlefield')
  }

  // Find the ability on the card
  const ability = ship.card.abilities?.find(a => a.id === command.data.abilityId)
  if (!ability) {
    throw new InvalidCommandError('Ability not found on card')
  }

  // Check cooldown
  const cooldown = ship.abilityCooldowns[command.data.abilityId] ?? 0
  if (cooldown > 0) {
    throw new InvalidCommandError(`Ability on cooldown (${cooldown} turns remaining)`)
  }

  // Check energy cost
  const energyCost = ability.energyCost ?? 0
  if (battle.player.energy.current < energyCost) {
    throw new InvalidCommandError(`Not enough energy (need ${energyCost})`)
  }

  const ts = timestamp()

  // For now, just emit the activation event
  // Full ability effects would be implemented per ability type
  return [
    {
      type: 'ABILITY_ACTIVATED',
      data: {
        timestamp: ts,
        battleId: battle.battleId,
        cardId: command.data.cardId,
        abilityId: command.data.abilityId,
        targetIds: command.data.targetId ? [command.data.targetId] : [],
        energyCost
      }
    }
  ]
}

function handleMoveShip(
  command: { type: 'MOVE_SHIP'; data: { cardId: string; toPosition: number } },
  state: GameState
): GameEvent[] {
  if (!state.currentTacticalBattle) {
    throw new InvalidCommandError('No tactical battle in progress')
  }

  const battle = state.currentTacticalBattle

  if (battle.phase !== 'playing') {
    throw new InvalidCommandError('Battle is not in playing phase')
  }

  if (battle.activePlayer !== 'player') {
    throw new InvalidCommandError('Not your turn')
  }

  const { cardId, toPosition } = command.data

  // Validate position
  if (toPosition < 1 || toPosition > 5) {
    throw new InvalidCommandError('Invalid position (must be 1-5)')
  }

  // Find ship on battlefield
  const shipIndex = battle.player.battlefield.findIndex(
    s => s && s.cardId === cardId
  )
  if (shipIndex === -1) {
    throw new InvalidCommandError('Ship not found on battlefield')
  }

  const ship = battle.player.battlefield[shipIndex]!
  const fromPosition = ship.position

  if (fromPosition === toPosition) {
    throw new InvalidCommandError('Ship is already at that position')
  }

  // Check if destination is empty
  if (battle.player.battlefield[toPosition - 1] !== null) {
    throw new InvalidCommandError('Destination position is occupied')
  }

  // Check energy cost
  const moveCost = TACTICAL_BATTLE_CONFIG.moveCost
  if (battle.player.energy.current < moveCost) {
    throw new InvalidCommandError(`Not enough energy to move (need ${moveCost})`)
  }

  const ts = timestamp()
  const newEnergy = battle.player.energy.current - moveCost

  return [
    {
      type: 'ENERGY_SPENT',
      data: {
        timestamp: ts,
        battleId: battle.battleId,
        player: 'player',
        amount: moveCost,
        newTotal: newEnergy,
        action: 'move'
      }
    },
    {
      type: 'SHIP_MOVED',
      data: {
        timestamp: ts,
        battleId: battle.battleId,
        cardId,
        player: 'player',
        fromPosition,
        toPosition,
        energyCost: moveCost
      }
    }
  ]
}

function handleDrawExtraCard(
  command: { type: 'DRAW_EXTRA_CARD'; data: Record<string, never> },
  state: GameState
): GameEvent[] {
  if (!state.currentTacticalBattle) {
    throw new InvalidCommandError('No tactical battle in progress')
  }

  const battle = state.currentTacticalBattle

  if (battle.phase !== 'playing') {
    throw new InvalidCommandError('Battle is not in playing phase')
  }

  if (battle.activePlayer !== 'player') {
    throw new InvalidCommandError('Not your turn')
  }

  // Check hand size limit
  if (battle.player.hand.length >= TACTICAL_BATTLE_CONFIG.maxHandSize) {
    throw new InvalidCommandError('Hand is full')
  }

  // Check deck has cards
  if (battle.player.deck.length === 0) {
    throw new InvalidCommandError('No cards left in deck')
  }

  // Check energy cost
  const drawCost = TACTICAL_BATTLE_CONFIG.drawCardCost
  if (battle.player.energy.current < drawCost) {
    throw new InvalidCommandError(`Not enough energy to draw (need ${drawCost})`)
  }

  const ts = timestamp()
  const newEnergy = battle.player.energy.current - drawCost
  const cardToDraw = battle.player.deck[0]

  return [
    {
      type: 'ENERGY_SPENT',
      data: {
        timestamp: ts,
        battleId: battle.battleId,
        player: 'player',
        amount: drawCost,
        newTotal: newEnergy,
        action: 'draw'
      }
    },
    {
      type: 'TACTICAL_CARD_DRAWN',
      data: {
        timestamp: ts,
        battleId: battle.battleId,
        player: 'player',
        cardId: cardToDraw,
        deckRemaining: battle.player.deck.length - 1
      }
    }
  ]
}

function handleEndTurn(
  command: { type: 'END_TURN'; data: Record<string, never> },
  state: GameState
): GameEvent[] {
  if (!state.currentTacticalBattle) {
    throw new InvalidCommandError('No tactical battle in progress')
  }

  const battle = state.currentTacticalBattle

  if (battle.phase !== 'playing') {
    throw new InvalidCommandError('Battle is not in playing phase')
  }

  if (battle.activePlayer !== 'player') {
    throw new InvalidCommandError('Not your turn')
  }

  const ts = timestamp()
  const events: GameEvent[] = [
    {
      type: 'TACTICAL_TURN_ENDED',
      data: {
        timestamp: ts,
        battleId: battle.battleId,
        player: 'player',
        turnNumber: battle.turnNumber
      }
    }
  ]

  // Check round limit (each round = 2 turns, one per player)
  const roundNumber = Math.ceil((battle.turnNumber + 1) / 2)
  const isLastTurnOfRound = (battle.turnNumber + 1) % 2 === 0

  if (isLastTurnOfRound && roundNumber >= battle.roundLimit) {
    // Battle ends due to round limit - determine winner by flagship hull
    const winner: 'player' | 'opponent' | 'draw' =
      battle.player.flagship.currentHull > battle.opponent.flagship.currentHull ? 'player' :
      battle.opponent.flagship.currentHull > battle.player.flagship.currentHull ? 'opponent' :
      'draw'

    events.push({
      type: 'TACTICAL_BATTLE_RESOLVED',
      data: {
        timestamp: ts,
        battleId: battle.battleId,
        winner,
        victoryCondition: 'timeout',
        turnsPlayed: battle.turnNumber,
        playerFinalHull: battle.player.flagship.currentHull,
        opponentFinalHull: battle.opponent.flagship.currentHull,
        playerShipsDestroyed: 0, // Would need to track this
        opponentShipsDestroyed: 0 // Would need to track this
      }
    })
  } else {
    // Start opponent's turn (AI handling would go here)
    // For now, just emit turn start for opponent
    const newTurnNumber = battle.turnNumber + 1
    const energyRegen = TACTICAL_BATTLE_CONFIG.energyRegeneration
    const newEnergyTotal = Math.min(
      battle.opponent.energy.maximum,
      battle.opponent.energy.current + energyRegen
    )

    events.push({
      type: 'TACTICAL_TURN_STARTED',
      data: {
        timestamp: ts,
        battleId: battle.battleId,
        turnNumber: newTurnNumber,
        activePlayer: 'opponent',
        energyGained: energyRegen,
        newEnergyTotal
      }
    })
  }

  return events
}

function handleUseEmergencyReserves(
  command: { type: 'USE_EMERGENCY_RESERVES'; data: Record<string, never> },
  state: GameState
): GameEvent[] {
  if (!state.currentTacticalBattle) {
    throw new InvalidCommandError('No tactical battle in progress')
  }

  const battle = state.currentTacticalBattle

  if (battle.phase !== 'playing') {
    throw new InvalidCommandError('Battle is not in playing phase')
  }

  if (battle.activePlayer !== 'player') {
    throw new InvalidCommandError('Not your turn')
  }

  // Check if emergency reserves are available
  const reserves = battle.initiative.secondPlayerBonus.emergencyReserves
  if (!reserves.available) {
    throw new InvalidCommandError('Emergency reserves not available')
  }

  // Check if expired
  if (battle.turnNumber > reserves.expiresOnTurn) {
    throw new InvalidCommandError('Emergency reserves have expired')
  }

  const ts = timestamp()
  const energyGrant = reserves.energyGrant
  const newEnergyTotal = Math.min(
    battle.player.energy.maximum,
    battle.player.energy.current + energyGrant
  )

  return [
    {
      type: 'ENERGY_GAINED',
      data: {
        timestamp: ts,
        battleId: battle.battleId,
        player: 'player',
        amount: energyGrant,
        newTotal: newEnergyTotal,
        source: 'emergency_reserves'
      }
    }
  ]
}
