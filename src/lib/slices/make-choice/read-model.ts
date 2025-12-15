// ============================================================================
// MAKE-CHOICE SLICE - Read Model
// ============================================================================
//
// This module provides the read model (projection) for the narrative screen.
// It projects data needed for displaying and making choices in dilemmas.
//
// CONSUMES EVENTS:
// - GAME_STARTED: Initialize state
// - QUEST_ACCEPTED: Set active quest
// - DILEMMA_PRESENTED: Set current dilemma
// - CHOICE_MADE: Track choice history
// - REPUTATION_CHANGED: Track current reputation
// - CARD_GAINED: Track owned cards (for card economy preview)
// - CARD_LOST: Track owned cards
//
// VIEW TYPES:
// - DilemmaView: Full dilemma with voices, choices, and previews
// ============================================================================

import type { FactionId, GameEvent } from '../shared-kernel'
import { createProjection, getReputationStatus } from '../shared-kernel'

// Import content helpers
import { getDilemmaById, getQuestById } from '../../game/content/quests'

// ----------------------------------------------------------------------------
// View Types
// ----------------------------------------------------------------------------

export interface VoiceData {
  npcName: string
  factionId: FactionId | 'crew' | 'other'
  factionIcon: string
  factionColor: string
  dialogue: string
  position?: string
}

export interface ReputationPreview {
  factionId: FactionId
  factionIcon: string
  factionColor: string
  delta: number
  isPositive: boolean
}

export interface CardImpactPreview {
  currentCardCount: number
  gains: number
  losses: number
  netChange: number
  resultingTotal: number
  wouldCauseShortage: boolean
  warningMessage: string | null
}

export interface ChoiceData {
  choiceId: string
  label: string
  description?: string
  reputationPreviews: ReputationPreview[]
  cardsGained: string[]
  cardsLost: string[]
  bountyModifier?: number
  triggersBattle: boolean
  battleRole?: 'attacker' | 'defender'
  triggersAlliance: boolean
  triggersMediation: boolean
  riskDescription?: string
  riskProbability?: number
  cardImpact: CardImpactPreview
}

export interface DilemmaView {
  dilemmaId: string
  questId: string
  questTitle: string
  situation: string
  voices: VoiceData[]
  choices: ChoiceData[]
  isPostBattle: boolean
  battleContext?: string
}

// Legacy type alias for backward compatibility
export type DilemmaViewData = DilemmaView

// ----------------------------------------------------------------------------
// Internal State
// ----------------------------------------------------------------------------

interface MakeChoiceSliceState {
  currentDilemmaId: string | null
  activeQuestId: string | null
  currentPhase: string
  ownedCardCount: number
  choiceHistory: Array<{
    dilemmaId: string
    choiceId: string
    questId: string
  }>
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const FACTION_ICONS: Record<FactionId | 'crew' | 'other', string> = {
  ironveil: '▣',
  ashfall: '◈',
  meridian: '⬡',
  void_wardens: '⛊',
  sundered_oath: '✕',
  crew: '○',
  other: '○'
}

const FACTION_COLORS: Record<FactionId | 'crew' | 'other', string> = {
  ironveil: '#c9a227',
  ashfall: '#e85d04',
  meridian: '#00b4d8',
  void_wardens: '#7209b7',
  sundered_oath: '#6c757d',
  crew: '#888888',
  other: '#888888'
}

const MIN_BATTLE_CARDS = 5

// ----------------------------------------------------------------------------
// State Reducer
// ----------------------------------------------------------------------------

function getInitialState(): MakeChoiceSliceState {
  return {
    currentDilemmaId: null,
    activeQuestId: null,
    currentPhase: 'quest_hub',
    ownedCardCount: 0,
    choiceHistory: []
  }
}

function reducer(state: MakeChoiceSliceState, event: GameEvent): MakeChoiceSliceState {
  switch (event.type) {
    case 'GAME_STARTED':
      return {
        ...getInitialState(),
        ownedCardCount: event.data.starterCardIds?.length ?? 0
      }

    case 'QUEST_ACCEPTED':
      return {
        ...state,
        activeQuestId: event.data.questId,
        ownedCardCount: state.ownedCardCount + (event.data.initialCardIds?.length ?? 0)
      }

    case 'DILEMMA_PRESENTED':
      return {
        ...state,
        currentDilemmaId: event.data.dilemmaId
      }

    case 'CHOICE_MADE':
      return {
        ...state,
        choiceHistory: [
          ...state.choiceHistory,
          {
            dilemmaId: event.data.dilemmaId,
            choiceId: event.data.choiceId,
            questId: event.data.questId
          }
        ]
      }

    case 'PHASE_CHANGED':
      return {
        ...state,
        currentPhase: event.data.toPhase
      }

    case 'CARD_GAINED':
      return {
        ...state,
        ownedCardCount: state.ownedCardCount + 1
      }

    case 'CARD_LOST':
      return {
        ...state,
        ownedCardCount: Math.max(0, state.ownedCardCount - 1)
      }

    case 'QUEST_COMPLETED':
    case 'QUEST_FAILED':
      return {
        ...state,
        activeQuestId: null,
        currentDilemmaId: null
      }

    default:
      return state
  }
}

// ----------------------------------------------------------------------------
// Projection Factory
// ----------------------------------------------------------------------------

/**
 * Create a make-choice projection that builds state from events.
 */
export function createMakeChoiceProjection() {
  return createProjection(getInitialState(), reducer)
}

// ----------------------------------------------------------------------------
// View Builders
// ----------------------------------------------------------------------------

/**
 * Build the dilemma view from current state.
 */
export function buildDilemmaView(
  state: MakeChoiceSliceState,
  dilemmaId?: string
): DilemmaView | null {
  // Use provided dilemmaId or current one from state
  const targetDilemmaId = dilemmaId || state.currentDilemmaId
  if (!targetDilemmaId) return null

  // Get dilemma content
  const dilemmaContent = getDilemmaById(targetDilemmaId)
  if (!dilemmaContent) {
    return createPlaceholderDilemma(targetDilemmaId, state.activeQuestId || '')
  }

  // Get quest for title
  const quest = getQuestById(dilemmaContent.questId)
  const questTitle = quest?.title || dilemmaContent.questId

  // Build voices
  const voices: VoiceData[] = dilemmaContent.voices.map(v => ({
    npcName: v.npcName,
    factionId: v.faction as FactionId | 'crew' | 'other',
    factionIcon: FACTION_ICONS[v.faction as FactionId | 'crew' | 'other'] || '○',
    factionColor: FACTION_COLORS[v.faction as FactionId | 'crew' | 'other'] || '#888888',
    dialogue: v.dialogue,
    position: v.position
  }))

  // Check if a battle is upcoming
  const battleUpcoming = dilemmaContent.choices.some(choice =>
    choice.consequences.triggersBattle || choice.consequences.triggersAlliance
  )

  // Build choices with previews
  const choices: ChoiceData[] = dilemmaContent.choices.map(c => {
    const gains = c.consequences.cardsGained.length
    const losses = c.consequences.cardsLost.length
    const netChange = gains - losses
    const resultingTotal = state.ownedCardCount + netChange

    const wouldCauseShortage = battleUpcoming && resultingTotal < MIN_BATTLE_CARDS

    let warningMessage: string | null = null
    if (wouldCauseShortage) {
      warningMessage = `This choice will leave you with ${resultingTotal} cards, but you need ${MIN_BATTLE_CARDS} for battle.`
    }

    return {
      choiceId: c.id,
      label: c.label,
      description: c.description,
      reputationPreviews: c.consequences.reputationChanges.map(rc => ({
        factionId: rc.faction,
        factionIcon: FACTION_ICONS[rc.faction],
        factionColor: FACTION_COLORS[rc.faction],
        delta: rc.delta,
        isPositive: rc.delta > 0
      })),
      cardsGained: c.consequences.cardsGained,
      cardsLost: c.consequences.cardsLost,
      bountyModifier: c.consequences.bountyModifier,
      triggersBattle: !!c.consequences.triggersBattle,
      battleRole: c.consequences.triggersBattle ? 'attacker' : undefined,
      triggersAlliance: !!c.consequences.triggersAlliance,
      triggersMediation: !!c.consequences.triggersMediation,
      riskDescription: c.consequences.risk?.description,
      riskProbability: c.consequences.risk?.probability,
      cardImpact: {
        currentCardCount: state.ownedCardCount,
        gains,
        losses,
        netChange,
        resultingTotal,
        wouldCauseShortage,
        warningMessage
      }
    }
  })

  const isPostBattle = targetDilemmaId.includes('post_battle') ||
    state.currentPhase === 'post_battle_dilemma'

  return {
    dilemmaId: targetDilemmaId,
    questId: dilemmaContent.questId,
    questTitle,
    situation: dilemmaContent.situation,
    voices,
    choices,
    isPostBattle
  }
}

// ----------------------------------------------------------------------------
// Convenience Functions
// ----------------------------------------------------------------------------

/**
 * Project dilemma view directly from events.
 */
export function projectDilemmaFromEvents(
  events: GameEvent[],
  dilemmaId?: string
): DilemmaView | null {
  const state = events.reduce(reducer, getInitialState())
  return buildDilemmaView(state, dilemmaId)
}

// ----------------------------------------------------------------------------
// Legacy API Adapters
// ----------------------------------------------------------------------------

/**
 * Legacy game state interface for backward compatibility.
 */
interface LegacyGameState {
  currentDilemmaId: string | null
  activeQuest: { questId: string } | null
  currentPhase: string
  ownedCards: Array<{ id: string }>
}

/**
 * Convert legacy GameState to slice internal state.
 */
function fromLegacyState(legacyState: LegacyGameState): MakeChoiceSliceState {
  return {
    currentDilemmaId: legacyState.currentDilemmaId,
    activeQuestId: legacyState.activeQuest?.questId ?? null,
    currentPhase: legacyState.currentPhase,
    ownedCardCount: legacyState.ownedCards.length,
    choiceHistory: []
  }
}

/**
 * Project dilemma view from events OR provided state.
 * Maintains backward compatibility with existing UI API.
 */
export function projectDilemmaView(
  events: GameEvent[],
  dilemmaId?: string,
  providedState?: LegacyGameState
): DilemmaView | null {
  if (providedState) {
    const sliceState = fromLegacyState(providedState)
    return buildDilemmaView(sliceState, dilemmaId)
  }
  return projectDilemmaFromEvents(events, dilemmaId)
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function createPlaceholderDilemma(dilemmaId: string, questId: string): DilemmaView {
  const quest = getQuestById(questId)
  const defaultCardImpact: CardImpactPreview = {
    currentCardCount: 0,
    gains: 0,
    losses: 0,
    netChange: 0,
    resultingTotal: 0,
    wouldCauseShortage: false,
    warningMessage: null
  }

  return {
    dilemmaId,
    questId,
    questTitle: quest?.title || questId,
    situation: 'A difficult situation presents itself. You must decide how to proceed.',
    voices: [
      {
        npcName: 'Advisor',
        factionId: 'crew',
        factionIcon: '○',
        factionColor: '#888888',
        dialogue: '"Captain, what are your orders?"'
      }
    ],
    choices: [
      {
        choiceId: 'placeholder_choice_a',
        label: 'Option A',
        reputationPreviews: [],
        cardsGained: [],
        cardsLost: [],
        triggersBattle: false,
        triggersAlliance: false,
        triggersMediation: false,
        cardImpact: defaultCardImpact
      },
      {
        choiceId: 'placeholder_choice_b',
        label: 'Option B',
        reputationPreviews: [],
        cardsGained: [],
        cardsLost: [],
        triggersBattle: false,
        triggersAlliance: false,
        triggersMediation: false,
        cardImpact: defaultCardImpact
      }
    ],
    isPostBattle: false
  }
}
