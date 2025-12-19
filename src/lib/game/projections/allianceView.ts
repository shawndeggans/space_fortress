// ============================================================================
// SPACE FORTRESS - Alliance View Projection
// ============================================================================
//
// Projects the alliance screen data including:
// - Available faction options with status
// - Alliance terms with NPC dialogue
// - Cards provided and bounty share
//
// Used by: Alliance screen, Alliance Terms modal
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

export interface AllianceOptionView {
  factionId: FactionId
  factionName: string
  factionIcon: string
  factionColor: string
  available: boolean
  unavailableReason?: string
  currentReputation: number
  reputationStatus: ReputationStatus
  bountyShare: number
  cardCount: number
  cardProfile: string  // e.g., "Tank", "Interceptor"

  // Card economy guidance
  resultingCardCount: number  // How many cards player would have after forming this alliance

  // Alliance state
  isAllied: boolean  // Whether player already formed alliance with this faction
}

export interface AllianceOptionsView {
  // Context
  questId: string
  questTitle: string
  battleContext: string

  // Faction options
  options: AllianceOptionView[]

  // State
  hasSelectedAlliance: boolean
  selectedFactionId: FactionId | null
  allianceCount: number  // Number of alliances formed
  alliedFactionIds: FactionId[]  // List of factions already allied
  totalBountyShare: number  // Total bounty share percentage across all alliances

  // Card economy guidance
  ownedCardCount: number
  requiredCardCount: number  // Always 5 for battle
  needsAlliance: boolean  // true if ownedCards < 5

  // Proceed without allies option
  canProceedAlone: boolean
  canContinue: boolean  // Can continue to card selection (has 5+ cards)
  proceedAloneWarning: string
  aloneBlockedReason: string | null  // If can't proceed alone, explains why
}

export interface AllianceTermsViewData {
  factionId: FactionId
  factionName: string
  factionIcon: string
  factionColor: string

  // Representative NPC
  representativeName: string
  representativeDialogue: string

  // Terms
  cardsProvided: CardTermView[]
  bountyShare: number
  battleRole: 'attacker' | 'defender'

  // Reputation effects
  reputationGain: number
  conflictWarnings: ConflictWarningView[]

  // Availability
  canAccept: boolean
  rejectReason?: string
}

export interface CardTermView {
  name: string
  factionIcon: string
  attack: number
  defense: number
  agility: number
}

export interface ConflictWarningView {
  factionId: FactionId
  factionIcon: string
  factionName: string
  delta: number
  reason: string
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

const FACTION_CARD_PROFILES: Record<FactionId, string> = {
  ironveil: 'Siege',
  ashfall: 'Interceptor',
  meridian: 'Balanced',
  void_wardens: 'Tank',
  sundered_oath: 'Glass Cannon'
}

// Placeholder alliance data - will come from content
interface AllianceData {
  factionId: FactionId
  representativeName: string
  dialogue: string
  bountyShare: number
  cardCount: number
  battleRole: 'attacker' | 'defender'
  reputationGain: number
  conflicts: Array<{ faction: FactionId; delta: number; reason: string }>
}

const ALLIANCE_DATA: Record<FactionId, AllianceData> = {
  ironveil: {
    factionId: 'ironveil',
    representativeName: 'Castellan Vorn',
    dialogue: '"Our siege ships can break any defense. 30% is our standard rate."',
    bountyShare: 0.30,
    cardCount: 2,
    battleRole: 'attacker',
    reputationGain: 5,
    conflicts: [{ faction: 'ashfall', delta: -10, reason: 'Ironveil rival' }]
  },
  ashfall: {
    factionId: 'ashfall',
    representativeName: 'Elder Yara',
    dialogue: '"Our interceptors strike swift and true. Help our cause, and we help yours."',
    bountyShare: 0.20,
    cardCount: 2,
    battleRole: 'attacker',
    reputationGain: 10,
    conflicts: [{ faction: 'ironveil', delta: -15, reason: 'Ashfall rival' }]
  },
  meridian: {
    factionId: 'meridian',
    representativeName: 'Broker Desh',
    dialogue: '"Balanced forces, fair terms. A professional arrangement."',
    bountyShare: 0.25,
    cardCount: 2,
    battleRole: 'attacker',
    reputationGain: 5,
    conflicts: []
  },
  void_wardens: {
    factionId: 'void_wardens',
    representativeName: 'Sentinel Krath',
    dialogue: '"We will provide defensive coverage. 30% is standard. Take it or leave."',
    bountyShare: 0.30,
    cardCount: 2,
    battleRole: 'defender',
    reputationGain: 5,
    conflicts: []
  },
  sundered_oath: {
    factionId: 'sundered_oath',
    representativeName: 'The Broken Voice',
    dialogue: '"Power at any cost. Our glass cannons will devastate them."',
    bountyShare: 0.35,
    cardCount: 2,
    battleRole: 'attacker',
    reputationGain: 10,
    conflicts: [
      { faction: 'meridian', delta: -10, reason: 'Sundered methods' },
      { faction: 'void_wardens', delta: -15, reason: 'Oath breakers' }
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
// Projection Functions
// ----------------------------------------------------------------------------

export function projectAllianceOptions(events: GameEvent[], providedState?: GameState): AllianceOptionsView | null {
  const state = providedState ?? rebuildState(events)

  if (!state.activeQuest) return null

  // Get available factions from alliance phase event
  const alliancePhaseEvent = events.find(
    e => e.type === 'ALLIANCE_PHASE_STARTED' && e.data.questId === state.activeQuest?.questId
  )

  let availableFactionIds: FactionId[] = ['ironveil', 'ashfall', 'meridian', 'void_wardens', 'sundered_oath']
  let battleContext = 'Prepare for battle'

  if (alliancePhaseEvent && alliancePhaseEvent.type === 'ALLIANCE_PHASE_STARTED') {
    availableFactionIds = alliancePhaseEvent.data.availableFactionIds
    battleContext = alliancePhaseEvent.data.battleContext
  }

  // Card economy calculations
  const REQUIRED_BATTLE_CARDS = 5
  const ownedCardCount = state.ownedCards.length

  // Get already-allied factions
  const alliedFactionIds = state.activeQuest.alliances.map(a => a.faction)
  const allianceCount = alliedFactionIds.length
  const totalBountyShare = state.activeQuest.alliances.reduce((sum, a) => sum + Math.round(a.bountyShare * 100), 0)

  // Build faction options
  const options: AllianceOptionView[] = []

  for (const factionId of availableFactionIds) {
    const currentRep = state.reputation[factionId]
    const status = getReputationStatus(currentRep)
    const isHostile = status === 'hostile'
    const isAllied = alliedFactionIds.includes(factionId)
    const allianceCardCount = ALLIANCE_DATA[factionId].cardCount

    options.push({
      factionId,
      factionName: FACTION_NAMES[factionId],
      factionIcon: FACTION_ICONS[factionId],
      factionColor: FACTION_COLORS[factionId],
      available: !isHostile && !isAllied,
      unavailableReason: isAllied ? 'Already allied' : (isHostile ? "We don't work with your kind." : undefined),
      currentReputation: currentRep,
      reputationStatus: status,
      bountyShare: Math.round(ALLIANCE_DATA[factionId].bountyShare * 100),
      cardCount: allianceCardCount,
      cardProfile: FACTION_CARD_PROFILES[factionId],
      resultingCardCount: ownedCardCount + allianceCardCount,
      isAllied
    })
  }

  // Determine if player can proceed alone (no alliances, but enough cards)
  const needsAlliance = ownedCardCount < REQUIRED_BATTLE_CARDS
  const canProceedAlone = !needsAlliance && allianceCount === 0
  const canContinue = ownedCardCount >= REQUIRED_BATTLE_CARDS  // Has enough cards to continue
  let aloneBlockedReason: string | null = null
  let proceedAloneWarning = 'You will enter battle with only your current fleet.'

  if (needsAlliance) {
    aloneBlockedReason = `You need ${REQUIRED_BATTLE_CARDS} cards for battle but only have ${ownedCardCount}. Form an alliance to gain more cards.`
  } else {
    proceedAloneWarning = 'You will enter battle without ally support. Consider forming an alliance for tactical advantage.'
  }

  return {
    questId: state.activeQuest.questId,
    questTitle: QUEST_TITLES[state.activeQuest.questId] || state.activeQuest.questId,
    battleContext,
    options,
    hasSelectedAlliance: allianceCount > 0,
    selectedFactionId: state.activeQuest.alliances[0]?.faction || null,
    allianceCount,
    alliedFactionIds,
    totalBountyShare,
    ownedCardCount,
    requiredCardCount: REQUIRED_BATTLE_CARDS,
    needsAlliance,
    canProceedAlone,
    canContinue,
    proceedAloneWarning,
    aloneBlockedReason
  }
}

export function projectAllianceTermsView(events: GameEvent[], factionId: FactionId, providedState?: GameState): AllianceTermsViewData | null {
  const state = providedState ?? rebuildState(events)
  const allianceData = ALLIANCE_DATA[factionId]

  if (!allianceData) return null

  const currentRep = state.reputation[factionId]
  const status = getReputationStatus(currentRep)
  const canAccept = status !== 'hostile'

  // Build conflict warnings
  const conflictWarnings: ConflictWarningView[] = allianceData.conflicts.map(c => ({
    factionId: c.faction,
    factionIcon: FACTION_ICONS[c.faction],
    factionName: FACTION_NAMES[c.faction],
    delta: c.delta,
    reason: c.reason
  }))

  // Placeholder cards - will come from content
  const cardsProvided: CardTermView[] = [
    {
      name: `${FACTION_NAMES[factionId]} Ship Alpha`,
      factionIcon: FACTION_ICONS[factionId],
      attack: getStatForProfile(FACTION_CARD_PROFILES[factionId], 'attack'),
      defense: getStatForProfile(FACTION_CARD_PROFILES[factionId], 'defense'),
      agility: getStatForProfile(FACTION_CARD_PROFILES[factionId], 'agility')
    },
    {
      name: `${FACTION_NAMES[factionId]} Ship Beta`,
      factionIcon: FACTION_ICONS[factionId],
      attack: getStatForProfile(FACTION_CARD_PROFILES[factionId], 'attack'),
      defense: getStatForProfile(FACTION_CARD_PROFILES[factionId], 'defense'),
      agility: getStatForProfile(FACTION_CARD_PROFILES[factionId], 'agility')
    }
  ]

  return {
    factionId,
    factionName: FACTION_NAMES[factionId],
    factionIcon: FACTION_ICONS[factionId],
    factionColor: FACTION_COLORS[factionId],
    representativeName: allianceData.representativeName,
    representativeDialogue: allianceData.dialogue,
    cardsProvided,
    bountyShare: Math.round(allianceData.bountyShare * 100),
    battleRole: allianceData.battleRole,
    reputationGain: allianceData.reputationGain,
    conflictWarnings,
    canAccept,
    rejectReason: !canAccept ? 'Faction is hostile and will not ally with you' : undefined
  }
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function getStatForProfile(profile: string, stat: 'attack' | 'defense' | 'agility'): number {
  const profiles: Record<string, Record<string, number>> = {
    'Siege': { attack: 5, defense: 4, agility: 1 },
    'Interceptor': { attack: 3, defense: 2, agility: 5 },
    'Balanced': { attack: 3, defense: 4, agility: 3 },
    'Tank': { attack: 1, defense: 7, agility: 2 },
    'Glass Cannon': { attack: 6, defense: 2, agility: 2 }
  }

  return profiles[profile]?.[stat] || 3
}
