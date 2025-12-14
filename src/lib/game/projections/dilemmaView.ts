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
// ============================================================================

import type { GameEvent } from '../events'
import type {
  FactionId,
  ReputationStatus
, GameState } from '../types'
import { rebuildState } from '../projections'
import { getReputationStatus } from '../types'

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

// Placeholder dilemma data - will be replaced with content module
interface DilemmaContent {
  id: string
  questId: string
  situation: string
  voices: Array<{
    npcName: string
    faction: FactionId | 'crew' | 'other'
    dialogue: string
    position?: string
  }>
  choices: Array<{
    id: string
    label: string
    description?: string
    reputationChanges: Array<{ faction: FactionId; delta: number }>
    cardsGained: string[]
    cardsLost: string[]
    bountyModifier?: number
    triggersBattle?: { role: 'attacker' | 'defender' }
    triggersAlliance?: boolean
    triggersMediation?: boolean
    risk?: { description: string; probability: number }
  }>
}

const DILEMMA_DATA: Record<string, DilemmaContent> = {
  'quest_salvage_claim_dilemma_1': {
    id: 'quest_salvage_claim_dilemma_1',
    questId: 'quest_salvage_claim',
    situation: 'You need escort capability to reach the derelict. Ironveil has firepower but not speed. You need interceptors to screen your approach.',
    voices: [
      {
        npcName: 'Castellan Vorn',
        faction: 'ironveil',
        dialogue: '"The Void Wardens patrol this sector. They owe me. I can call in the favor, but they\'ll want 30% of salvage value. Non-negotiable."',
        position: 'Recommends Void Warden alliance'
      },
      {
        npcName: 'First Officer',
        faction: 'crew',
        dialogue: '"The Remnants have fast ships. If you approach Elder Yara carefully, offer them access to search for survivors, they might escort us. But Ironveil won\'t like it."',
        position: 'Suggests Ashfall approach'
      },
      {
        npcName: 'Broker Desh',
        faction: 'meridian',
        dialogue: '"I know a mercenary wing operating out of the Reaches. They\'ll take 20% and ask no questions. But they have no stake in the outcome—they\'ll cut and run if it goes bad."',
        position: 'Offers mercenary option'
      }
    ],
    choices: [
      {
        id: 'choice_void_wardens',
        label: 'Void Wardens Alliance',
        description: 'Form alliance with Void Wardens for escort',
        reputationChanges: [{ faction: 'void_wardens', delta: 5 }],
        cardsGained: ['vw_bastion', 'vw_cruiser'],
        cardsLost: [],
        bountyModifier: -0.30,
        triggersBattle: { role: 'defender' }
      },
      {
        id: 'choice_ashfall_secret',
        label: 'Ashfall Alliance (secret deal)',
        description: 'Secret arrangement with Ashfall Remnants',
        reputationChanges: [{ faction: 'ashfall', delta: 10 }],
        cardsGained: ['af_interceptor_1', 'af_interceptor_2'],
        cardsLost: [],
        triggersBattle: { role: 'attacker' },
        risk: { description: 'Ironveil may discover the secret deal', probability: 0.3 }
      },
      {
        id: 'choice_mercenaries',
        label: 'Mercenary Alliance',
        description: 'Hire mercenaries for escort',
        reputationChanges: [],
        cardsGained: ['merc_ship_1', 'merc_ship_2'],
        cardsLost: [],
        bountyModifier: -0.20,
        triggersBattle: { role: 'attacker' },
        risk: { description: 'Mercenaries may flee if battle goes poorly', probability: 0.25 }
      }
    ]
  }
}

// Quest titles lookup
const QUEST_TITLES: Record<string, string> = {
  quest_salvage_claim: 'The Salvage Claim',
  quest_sanctuary_run: 'The Sanctuary Run',
  quest_brokers_gambit: "The Broker's Gambit"
}

// ----------------------------------------------------------------------------
// Projection Function
// ----------------------------------------------------------------------------

export function projectDilemmaView(events: GameEvent[], dilemmaId?: string, providedState?: GameState): DilemmaViewData | null {
  const state = providedState ?? rebuildState(events)

  // Use provided dilemmaId or current one from state
  const targetDilemmaId = dilemmaId || state.currentDilemmaId
  if (!targetDilemmaId) return null

  const dilemmaContent = DILEMMA_DATA[targetDilemmaId]
  if (!dilemmaContent) {
    // Return a placeholder for unknown dilemmas
    return createPlaceholderDilemma(targetDilemmaId, state.activeQuest?.questId || '')
  }

  // Build voices
  const voices: VoiceData[] = dilemmaContent.voices.map(v => ({
    npcName: v.npcName,
    factionId: v.faction,
    factionIcon: FACTION_ICONS[v.faction],
    factionColor: FACTION_COLORS[v.faction],
    dialogue: v.dialogue,
    position: v.position
  }))

  // Build choices with consequence previews
  const choices: ChoiceData[] = dilemmaContent.choices.map(c => ({
    choiceId: c.id,
    label: c.label,
    description: c.description,
    reputationPreviews: c.reputationChanges.map(rc => ({
      factionId: rc.faction,
      factionIcon: FACTION_ICONS[rc.faction],
      factionColor: FACTION_COLORS[rc.faction],
      delta: rc.delta,
      isPositive: rc.delta > 0
    })),
    cardsGained: c.cardsGained,
    cardsLost: c.cardsLost,
    bountyModifier: c.bountyModifier,
    triggersBattle: !!c.triggersBattle,
    battleRole: c.triggersBattle?.role,
    triggersAlliance: !!c.triggersAlliance,
    triggersMediation: !!c.triggersMediation,
    riskDescription: c.risk?.description,
    riskProbability: c.risk?.probability
  }))

  // Determine if this is a post-battle dilemma
  const isPostBattle = targetDilemmaId.includes('post_battle') || state.currentPhase === 'post_battle_dilemma'

  return {
    dilemmaId: targetDilemmaId,
    questId: dilemmaContent.questId,
    questTitle: QUEST_TITLES[dilemmaContent.questId] || dilemmaContent.questId,
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
  return {
    dilemmaId,
    questId,
    questTitle: QUEST_TITLES[questId] || questId,
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
        triggersMediation: false
      },
      {
        choiceId: 'placeholder_choice_b',
        label: 'Option B',
        reputationPreviews: [],
        cardsGained: [],
        cardsLost: [],
        triggersBattle: false,
        triggersAlliance: false,
        triggersMediation: false
      }
    ],
    isPostBattle: false
  }
}
