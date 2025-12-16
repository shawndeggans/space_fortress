// ============================================================================
// SPACE FORTRESS - Dilemma View Projection
// ============================================================================
//
// Projects the narrative screen data including:
// - Current situation text
// - NPC voices with dialogue
// - Available choices with consequence previews
//
// Used by: Narrative screen, Post-Battle Dilemma screen
//
// NOTE: This projection can use either:
// 1. Legacy quest/dilemma content (default, for backward compatibility)
// 2. Narrative graph content (when USE_NARRATIVE_GRAPHS is true)
// ============================================================================

import type { GameEvent } from '../events'
import type {
  FactionId,
  ReputationStatus,
  GameState
} from '../types'
import { rebuildState } from '../projections'
import { getReputationStatus } from '../types'
import { getDilemmaById, getQuestById } from '../content/quests'
import { projectNarrativeView, toLegacyDilemmaView } from '../../narrative/projections'
import { hasGraph } from '../../narrative/content'

// Feature flag: Set to true to use narrative graphs when available
const USE_NARRATIVE_GRAPHS = true

// ----------------------------------------------------------------------------
// View Types
// ----------------------------------------------------------------------------

export interface VoiceData {
  npcName: string
  factionId: FactionId | 'crew' | 'other'
  factionIcon: string
  factionColor: string
  dialogue: string
  position?: string  // Their stance on the issue
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
  wouldCauseShortage: boolean  // True if result < 5 and battle is upcoming
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

  // Card economy impact preview
  cardImpact: CardImpactPreview
}

export interface DilemmaViewData {
  dilemmaId: string
  questId: string
  questTitle: string
  situation: string
  voices: VoiceData[]
  choices: ChoiceData[]
  isPostBattle: boolean
  battleContext?: string
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

// Quest titles are now derived from actual quest content via getQuestById()

// ----------------------------------------------------------------------------
// Projection Function
// ----------------------------------------------------------------------------

export function projectDilemmaView(events: GameEvent[], dilemmaId?: string, providedState?: GameState): DilemmaViewData | null {
  const state = providedState ?? rebuildState(events)

  // Use provided dilemmaId or current one from state
  const targetDilemmaId = dilemmaId || state.currentDilemmaId
  if (!targetDilemmaId) return null

  // Try narrative graph system first if enabled
  if (USE_NARRATIVE_GRAPHS && state.activeQuest?.questId) {
    const questId = state.activeQuest.questId
    if (hasGraph(questId)) {
      const narrativeView = projectNarrativeView(events, state)
      if (narrativeView) {
        // Convert to legacy format for backward compatibility
        const legacyView = toLegacyDilemmaView(narrativeView)
        return legacyView as DilemmaViewData
      }
    }
  }

  // Fall back to legacy quest/dilemma content
  const dilemmaContent = getDilemmaById(targetDilemmaId)
  if (!dilemmaContent) {
    // Return a placeholder for unknown dilemmas
    return createPlaceholderDilemma(targetDilemmaId, state.activeQuest?.questId || '')
  }

  // Get quest for title
  const quest = getQuestById(dilemmaContent.questId)
  const questTitle = quest?.title || dilemmaContent.questId

  // Build voices from actual content
  const voices: VoiceData[] = dilemmaContent.voices.map(v => ({
    npcName: v.npcName,
    factionId: v.faction as FactionId | 'crew' | 'other',
    factionIcon: FACTION_ICONS[v.faction as FactionId | 'crew' | 'other'] || '○',
    factionColor: FACTION_COLORS[v.faction as FactionId | 'crew' | 'other'] || '#888888',
    dialogue: v.dialogue,
    position: v.position
  }))

  // Card economy constants
  const MIN_BATTLE_CARDS = 5
  const currentCardCount = state.ownedCards.length

  // Check if a battle is upcoming (will need cards soon)
  const battleUpcoming = dilemmaContent.choices.some(choice =>
    choice.consequences.triggersBattle || choice.consequences.triggersAlliance
  )

  // Build choices with consequence previews from actual content
  const choices: ChoiceData[] = dilemmaContent.choices.map(c => {
    const gains = c.consequences.cardsGained.length
    const losses = c.consequences.cardsLost.length
    const netChange = gains - losses
    const resultingTotal = currentCardCount + netChange

    // Determine if this choice would cause a card shortage
    const wouldCauseShortage = battleUpcoming && resultingTotal < MIN_BATTLE_CARDS

    // Generate warning message if shortage would occur
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
        currentCardCount,
        gains,
        losses,
        netChange,
        resultingTotal,
        wouldCauseShortage,
        warningMessage
      }
    }
  })

  // Determine if this is a post-battle dilemma
  const isPostBattle = targetDilemmaId.includes('post_battle') || state.currentPhase === 'post_battle_dilemma'

  return {
    dilemmaId: targetDilemmaId,
    questId: dilemmaContent.questId,
    questTitle,
    situation: dilemmaContent.situation,
    voices,
    choices,
    isPostBattle,
    battleContext: isPostBattle ? state.currentBattle?.battleId : undefined
  }
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function createPlaceholderDilemma(dilemmaId: string, questId: string): DilemmaViewData {
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
