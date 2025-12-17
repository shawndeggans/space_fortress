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
  FactionId
} from './types'
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
      return sliceHandleLeanTowardFaction(command, state as unknown as MediationState)

    case 'REFUSE_TO_LEAN':
      return sliceHandleRefuseToLean(command, state as unknown as MediationState)

    case 'ACCEPT_COMPROMISE':
      return sliceHandleAcceptCompromise(command, state as unknown as MediationState)

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
      return sliceHandleSetCardPosition(command, state as DeploymentState)

    case 'LOCK_ORDERS':
      return sliceHandleLockOrders(command, state as DeploymentState)

    // ========================================================================
    // Battle: Execution
    // ========================================================================

    case 'CONTINUE_BATTLE':
      return handleContinueBattle(command, state)

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
    }
  ]

  // Emit CARD_GAINED events for each initial quest card
  for (const cardId of quest.initialCards) {
    const card = getCardById(cardId)
    if (card) {
      events.push({
        type: 'CARD_GAINED',
        data: {
          timestamp: ts,
          cardId,
          factionId: card.faction,
          source: 'quest'
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
