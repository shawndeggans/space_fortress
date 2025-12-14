// ============================================================================
// SPACE FORTRESS - Mediation View Projection
// ============================================================================
//
// Projects the mediation screen data including:
// - Facilitator introduction
// - Two-column faction positions
// - Lean toward options with previews
//
// Used by: Mediation screen
// ============================================================================

import type { GameEvent } from '../events'
import type { FactionId, ReputationStatus , GameState } from '../types'
import { rebuildState } from '../projections'
import { getReputationStatus } from '../types'

// ----------------------------------------------------------------------------
// View Types
// ----------------------------------------------------------------------------

export interface MediationPartyView {
  factionId: FactionId
  factionName: string
  factionIcon: string
  factionColor: string
  representativeName: string
  representativeDialogue: string
  position: string
  demands: string[]
  currentReputation: number
  reputationStatus: ReputationStatus
}

export interface LeanOptionView {
  towardFactionId: FactionId
  towardIcon: string
  towardName: string
  awayFromFactionId: FactionId
  awayIcon: string
  awayName: string
  reputationEffects: ReputationEffectPreview[]
  bountyModifier: number
  outcomePreview: string
}

export interface ReputationEffectPreview {
  factionId: FactionId
  factionIcon: string
  delta: number
  isPositive: boolean
}

export interface FacilitatorView {
  name: string
  factionId: FactionId
  factionIcon: string
  factionColor: string
  introDialogue: string
}

export interface MediationViewData {
  // Identification
  mediationId: string
  questId: string
  questTitle: string

  // Facilitator
  facilitator: FacilitatorView

  // The two parties
  parties: [MediationPartyView, MediationPartyView]

  // Lean options
  leanOptions: LeanOptionView[]

  // Refuse option
  canRefuseToLean: boolean
  refuseWarning: string

  // State
  hasLeaned: boolean
  leanedToward: FactionId | null
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const FACTION_ICONS: Record<FactionId, string> = {
  ironveil: '▣',
  ashfall: '◈',
  meridian: '⬡',
  void_wardens: '⛊',
  sundered_oath: '✕'
}

const FACTION_COLORS: Record<FactionId, string> = {
  ironveil: '#c9a227',
  ashfall: '#e85d04',
  meridian: '#00b4d8',
  void_wardens: '#7209b7',
  sundered_oath: '#6c757d'
}

const FACTION_NAMES: Record<FactionId, string> = {
  ironveil: 'Ironveil Syndicate',
  ashfall: 'Ashfall Remnants',
  meridian: 'Meridian Accord',
  void_wardens: 'Void Wardens',
  sundered_oath: 'Sundered Oath'
}

// Placeholder mediation data - will come from content
interface MediationData {
  id: string
  questId: string
  facilitator: {
    name: string
    factionId: FactionId
    dialogue: string
  }
  parties: Array<{
    factionId: FactionId
    representative: string
    dialogue: string
    position: string
    demands: string[]
  }>
  leanOptions: Array<{
    toward: FactionId
    away: FactionId
    repEffects: Array<{ faction: FactionId; delta: number }>
    bountyMod: number
    preview: string
  }>
}

const MEDIATION_DATA: Record<string, MediationData> = {
  'mediation_salvage': {
    id: 'mediation_salvage',
    questId: 'quest_salvage_claim',
    facilitator: {
      name: 'Broker Desh',
      factionId: 'meridian',
      dialogue: '"Someone has to move first. Captain, which side do you lean toward? I can build a compromise from there."'
    },
    parties: [
      {
        factionId: 'ironveil',
        representative: 'Castellan Vorn',
        dialogue: '"Survivors get passage out. Ironveil gets the ship and cargo. This is already generous."',
        position: 'Full salvage rights',
        demands: ['Ship ownership', 'Full cargo']
      },
      {
        factionId: 'ashfall',
        representative: 'Elder Yara',
        dialogue: '"Survivors get the ship. It\'s their home. Ironveil gets cargo only. Our people are not cargo."',
        position: 'Survivors first',
        demands: ['Ship for survivors', 'Ironveil: cargo only']
      }
    ],
    leanOptions: [
      {
        toward: 'ironveil',
        away: 'ashfall',
        repEffects: [
          { faction: 'ironveil', delta: 5 },
          { faction: 'ashfall', delta: -5 },
          { faction: 'meridian', delta: 10 }
        ],
        bountyMod: 0.60,
        preview: 'Ironveil gets ship, Ashfall gets safe passage for survivors'
      },
      {
        toward: 'ashfall',
        away: 'ironveil',
        repEffects: [
          { faction: 'ironveil', delta: -5 },
          { faction: 'ashfall', delta: 5 },
          { faction: 'meridian', delta: 10 }
        ],
        bountyMod: 0.30,
        preview: 'Survivors keep ship, Ironveil gets cargo value only'
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

export function projectMediationView(events: GameEvent[], mediationId?: string, providedState?: GameState): MediationViewData | null {
  const state = providedState ?? rebuildState(events)

  // Get mediation ID from state or parameter
  const targetMediationId = mediationId || state.currentMediationId
  if (!targetMediationId) return null

  const mediationData = MEDIATION_DATA[targetMediationId]
  if (!mediationData) {
    // Return placeholder if mediation data not found
    return createPlaceholderMediation(targetMediationId, state)
  }

  // Build facilitator view
  const facilitator: FacilitatorView = {
    name: mediationData.facilitator.name,
    factionId: mediationData.facilitator.factionId,
    factionIcon: FACTION_ICONS[mediationData.facilitator.factionId],
    factionColor: FACTION_COLORS[mediationData.facilitator.factionId],
    introDialogue: mediationData.facilitator.dialogue
  }

  // Build party views
  const parties: [MediationPartyView, MediationPartyView] = mediationData.parties.map(p => ({
    factionId: p.factionId,
    factionName: FACTION_NAMES[p.factionId],
    factionIcon: FACTION_ICONS[p.factionId],
    factionColor: FACTION_COLORS[p.factionId],
    representativeName: p.representative,
    representativeDialogue: p.dialogue,
    position: p.position,
    demands: p.demands,
    currentReputation: state.reputation[p.factionId],
    reputationStatus: getReputationStatus(state.reputation[p.factionId])
  })) as [MediationPartyView, MediationPartyView]

  // Build lean options
  const leanOptions: LeanOptionView[] = mediationData.leanOptions.map(opt => ({
    towardFactionId: opt.toward,
    towardIcon: FACTION_ICONS[opt.toward],
    towardName: FACTION_NAMES[opt.toward],
    awayFromFactionId: opt.away,
    awayIcon: FACTION_ICONS[opt.away],
    awayName: FACTION_NAMES[opt.away],
    reputationEffects: opt.repEffects.map(r => ({
      factionId: r.faction,
      factionIcon: FACTION_ICONS[r.faction],
      delta: r.delta,
      isPositive: r.delta > 0
    })),
    bountyModifier: Math.round(opt.bountyMod * 100),
    outcomePreview: opt.preview
  }))

  // Check if already leaned
  const leanEvent = events.find(
    e => e.type === 'MEDIATION_LEANED'
  )
  const hasLeaned = !!leanEvent
  const leanedToward = leanEvent && leanEvent.type === 'MEDIATION_LEANED'
    ? leanEvent.data.towardFactionId
    : null

  return {
    mediationId: targetMediationId,
    questId: mediationData.questId,
    questTitle: QUEST_TITLES[mediationData.questId] || mediationData.questId,
    facilitator,
    parties,
    leanOptions,
    canRefuseToLean: true,
    refuseWarning: 'Warning: Battle will be triggered',
    hasLeaned,
    leanedToward
  }
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function createPlaceholderMediation(mediationId: string, state: ReturnType<typeof rebuildState>): MediationViewData {
  return {
    mediationId,
    questId: state.activeQuest?.questId || '',
    questTitle: QUEST_TITLES[state.activeQuest?.questId || ''] || 'Mediation',
    facilitator: {
      name: 'Facilitator',
      factionId: 'meridian',
      factionIcon: '⬡',
      factionColor: '#00b4d8',
      introDialogue: '"Let us find common ground."'
    },
    parties: [
      {
        factionId: 'ironveil',
        factionName: 'Ironveil Syndicate',
        factionIcon: '▣',
        factionColor: '#c9a227',
        representativeName: 'Representative A',
        representativeDialogue: '"Our position is clear."',
        position: 'Position A',
        demands: ['Demand 1'],
        currentReputation: state.reputation.ironveil,
        reputationStatus: getReputationStatus(state.reputation.ironveil)
      },
      {
        factionId: 'ashfall',
        factionName: 'Ashfall Remnants',
        factionIcon: '◈',
        factionColor: '#e85d04',
        representativeName: 'Representative B',
        representativeDialogue: '"We stand firm."',
        position: 'Position B',
        demands: ['Demand 1'],
        currentReputation: state.reputation.ashfall,
        reputationStatus: getReputationStatus(state.reputation.ashfall)
      }
    ],
    leanOptions: [],
    canRefuseToLean: true,
    refuseWarning: 'Warning: Battle will be triggered',
    hasLeaned: false,
    leanedToward: null
  }
}
