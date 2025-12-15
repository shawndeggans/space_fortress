// ============================================================================
// FORM-ALLIANCE SLICE - Read Model
// ============================================================================
//
// This module provides the read model (projection) for the alliance screen.
// It projects data needed for displaying and forming alliances.
//
// CONSUMES EVENTS:
// - GAME_STARTED: Initialize state
// - QUEST_ACCEPTED: Track active quest and initial cards
// - ALLIANCE_PHASE_STARTED: Get available factions and context
// - ALLIANCE_FORMED: Track formed alliances
// - CARD_GAINED: Track owned card count
// - CARD_LOST: Track owned card count
// - REPUTATION_CHANGED: Track faction reputation
//
// VIEW TYPES:
// - AllianceOptionsView: Available factions and alliance status
// - AllianceTermsView: Detailed terms for a specific faction
// ============================================================================

import type { FactionId, GameEvent, ReputationStatus } from '../shared-kernel'
import { createProjection, getReputationStatus } from '../shared-kernel'

// Import content helpers
import { getAllianceCardIds } from '../../game/content/cards'
import { getQuestById } from '../../game/content/quests'
import { factions } from '../../game/content/factions'

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
  cardProfile: string
  resultingCardCount: number
  isAllied: boolean
}

export interface AllianceOptionsView {
  questId: string
  questTitle: string
  battleContext: string
  options: AllianceOptionView[]
  hasSelectedAlliance: boolean
  selectedFactionId: FactionId | null
  allianceCount: number
  alliedFactionIds: FactionId[]
  totalBountyShare: number
  ownedCardCount: number
  requiredCardCount: number
  needsAlliance: boolean
  canProceedAlone: boolean
  canContinue: boolean
  proceedAloneWarning: string
  aloneBlockedReason: string | null
}

export interface CardTermView {
  name: string
  factionIcon: string
  attack: number
  armor: number
  agility: number
}

export interface ConflictWarningView {
  factionId: FactionId
  factionIcon: string
  factionName: string
  delta: number
  reason: string
}

export interface AllianceTermsView {
  factionId: FactionId
  factionName: string
  factionIcon: string
  factionColor: string
  representativeName: string
  representativeDialogue: string
  cardsProvided: CardTermView[]
  bountyShare: number
  battleRole: 'attacker' | 'defender'
  reputationGain: number
  conflictWarnings: ConflictWarningView[]
  canAccept: boolean
  rejectReason?: string
}

// Legacy type alias
export type AllianceTermsViewData = AllianceTermsView

// ----------------------------------------------------------------------------
// Internal State
// ----------------------------------------------------------------------------

interface AllianceSliceState {
  activeQuestId: string | null
  currentPhase: string
  ownedCardCount: number
  reputation: Record<FactionId, number>
  alliances: Array<{
    factionId: FactionId
    bountyShare: number
    cardIds: string[]
  }>
  availableFactionIds: FactionId[]
  battleContext: string
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const REQUIRED_BATTLE_CARDS = 5

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

const FACTION_CARD_PROFILES: Record<FactionId, string> = {
  ironveil: 'Siege',
  ashfall: 'Interceptor',
  meridian: 'Balanced',
  void_wardens: 'Tank',
  sundered_oath: 'Glass Cannon'
}

const ALLIANCE_DATA: Record<FactionId, {
  representativeName: string
  dialogue: string
  bountyShare: number
  cardCount: number
  battleRole: 'attacker' | 'defender'
  reputationGain: number
  conflicts: Array<{ faction: FactionId; delta: number; reason: string }>
}> = {
  ironveil: {
    representativeName: 'Castellan Vorn',
    dialogue: '"Our siege ships can break any defense. 30% is our standard rate."',
    bountyShare: 0.30,
    cardCount: 2,
    battleRole: 'attacker',
    reputationGain: 5,
    conflicts: [{ faction: 'ashfall', delta: -10, reason: 'Ironveil rival' }]
  },
  ashfall: {
    representativeName: 'Elder Yara',
    dialogue: '"Our interceptors strike swift and true. Help our cause, and we help yours."',
    bountyShare: 0.20,
    cardCount: 2,
    battleRole: 'attacker',
    reputationGain: 10,
    conflicts: [{ faction: 'ironveil', delta: -15, reason: 'Ashfall rival' }]
  },
  meridian: {
    representativeName: 'Broker Desh',
    dialogue: '"Balanced forces, fair terms. A professional arrangement."',
    bountyShare: 0.25,
    cardCount: 2,
    battleRole: 'attacker',
    reputationGain: 5,
    conflicts: []
  },
  void_wardens: {
    representativeName: 'Sentinel Krath',
    dialogue: '"We will provide defensive coverage. 30% is standard. Take it or leave."',
    bountyShare: 0.30,
    cardCount: 2,
    battleRole: 'defender',
    reputationGain: 5,
    conflicts: []
  },
  sundered_oath: {
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

// ----------------------------------------------------------------------------
// State Reducer
// ----------------------------------------------------------------------------

function getInitialState(): AllianceSliceState {
  return {
    activeQuestId: null,
    currentPhase: 'quest_hub',
    ownedCardCount: 0,
    reputation: {
      ironveil: 0,
      ashfall: 0,
      meridian: 0,
      void_wardens: 0,
      sundered_oath: 0
    },
    alliances: [],
    availableFactionIds: ['ironveil', 'ashfall', 'meridian', 'void_wardens', 'sundered_oath'],
    battleContext: 'Prepare for battle'
  }
}

function reducer(state: AllianceSliceState, event: GameEvent): AllianceSliceState {
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
        ownedCardCount: state.ownedCardCount + (event.data.initialCardIds?.length ?? 0),
        alliances: []
      }

    case 'ALLIANCE_PHASE_STARTED':
      return {
        ...state,
        availableFactionIds: event.data.availableFactionIds,
        battleContext: event.data.battleContext
      }

    case 'PHASE_CHANGED':
      return {
        ...state,
        currentPhase: event.data.toPhase
      }

    case 'ALLIANCE_FORMED':
      return {
        ...state,
        alliances: [
          ...state.alliances,
          {
            factionId: event.data.factionId,
            bountyShare: event.data.bountyShare,
            cardIds: event.data.cardIdsProvided
          }
        ]
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

    case 'REPUTATION_CHANGED':
      return {
        ...state,
        reputation: {
          ...state.reputation,
          [event.data.factionId]: event.data.newValue
        }
      }

    case 'QUEST_COMPLETED':
    case 'QUEST_FAILED':
      return {
        ...state,
        activeQuestId: null,
        alliances: []
      }

    default:
      return state
  }
}

// ----------------------------------------------------------------------------
// Projection Factory
// ----------------------------------------------------------------------------

export function createAllianceProjection() {
  return createProjection(getInitialState(), reducer)
}

// ----------------------------------------------------------------------------
// View Builders
// ----------------------------------------------------------------------------

export function buildAllianceOptionsView(state: AllianceSliceState): AllianceOptionsView | null {
  if (!state.activeQuestId) return null

  const quest = getQuestById(state.activeQuestId)
  const questTitle = quest?.title || state.activeQuestId

  const alliedFactionIds = state.alliances.map(a => a.factionId)
  const allianceCount = alliedFactionIds.length
  const totalBountyShare = state.alliances.reduce(
    (sum, a) => sum + Math.round(a.bountyShare * 100),
    0
  )

  // Build faction options
  const options: AllianceOptionView[] = state.availableFactionIds.map(factionId => {
    const currentRep = state.reputation[factionId]
    const status = getReputationStatus(currentRep)
    const isHostile = status === 'hostile'
    const isAllied = alliedFactionIds.includes(factionId)
    const faction = factions[factionId]
    const allianceCardCount = ALLIANCE_DATA[factionId].cardCount

    return {
      factionId,
      factionName: faction?.name ?? factionId,
      factionIcon: FACTION_ICONS[factionId],
      factionColor: FACTION_COLORS[factionId],
      available: !isHostile && !isAllied,
      unavailableReason: isAllied
        ? 'Already allied'
        : isHostile
        ? "We don't work with your kind."
        : undefined,
      currentReputation: currentRep,
      reputationStatus: status,
      bountyShare: Math.round(ALLIANCE_DATA[factionId].bountyShare * 100),
      cardCount: allianceCardCount,
      cardProfile: FACTION_CARD_PROFILES[factionId],
      resultingCardCount: state.ownedCardCount + allianceCardCount,
      isAllied
    }
  })

  const needsAlliance = state.ownedCardCount < REQUIRED_BATTLE_CARDS
  const canProceedAlone = !needsAlliance && allianceCount === 0
  const canContinue = state.ownedCardCount >= REQUIRED_BATTLE_CARDS

  let aloneBlockedReason: string | null = null
  let proceedAloneWarning = 'You will enter battle with only your current fleet.'

  if (needsAlliance) {
    aloneBlockedReason = `You need ${REQUIRED_BATTLE_CARDS} cards for battle but only have ${state.ownedCardCount}. Form an alliance to gain more cards.`
  } else {
    proceedAloneWarning = 'You will enter battle without ally support. Consider forming an alliance for tactical advantage.'
  }

  return {
    questId: state.activeQuestId,
    questTitle,
    battleContext: state.battleContext,
    options,
    hasSelectedAlliance: allianceCount > 0,
    selectedFactionId: state.alliances[0]?.factionId || null,
    allianceCount,
    alliedFactionIds,
    totalBountyShare,
    ownedCardCount: state.ownedCardCount,
    requiredCardCount: REQUIRED_BATTLE_CARDS,
    needsAlliance,
    canProceedAlone,
    canContinue,
    proceedAloneWarning,
    aloneBlockedReason
  }
}

export function buildAllianceTermsView(
  state: AllianceSliceState,
  factionId: FactionId
): AllianceTermsView | null {
  const allianceData = ALLIANCE_DATA[factionId]
  if (!allianceData) return null

  const faction = factions[factionId]
  const currentRep = state.reputation[factionId]
  const status = getReputationStatus(currentRep)
  const canAccept = status !== 'hostile'

  // Build conflict warnings
  const conflictWarnings: ConflictWarningView[] = allianceData.conflicts.map(c => {
    const conflictFaction = factions[c.faction]
    return {
      factionId: c.faction,
      factionIcon: FACTION_ICONS[c.faction],
      factionName: conflictFaction?.name ?? c.faction,
      delta: c.delta,
      reason: c.reason
    }
  })

  // Placeholder cards
  const cardsProvided: CardTermView[] = [
    {
      name: `${faction?.name ?? factionId} Ship Alpha`,
      factionIcon: FACTION_ICONS[factionId],
      attack: getStatForProfile(FACTION_CARD_PROFILES[factionId], 'attack'),
      armor: getStatForProfile(FACTION_CARD_PROFILES[factionId], 'armor'),
      agility: getStatForProfile(FACTION_CARD_PROFILES[factionId], 'agility')
    },
    {
      name: `${faction?.name ?? factionId} Ship Beta`,
      factionIcon: FACTION_ICONS[factionId],
      attack: getStatForProfile(FACTION_CARD_PROFILES[factionId], 'attack'),
      armor: getStatForProfile(FACTION_CARD_PROFILES[factionId], 'armor'),
      agility: getStatForProfile(FACTION_CARD_PROFILES[factionId], 'agility')
    }
  ]

  return {
    factionId,
    factionName: faction?.name ?? factionId,
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
// Convenience Functions
// ----------------------------------------------------------------------------

export function projectAllianceOptionsFromEvents(events: GameEvent[]): AllianceOptionsView | null {
  const state = events.reduce(reducer, getInitialState())
  return buildAllianceOptionsView(state)
}

export function projectAllianceTermsFromEvents(
  events: GameEvent[],
  factionId: FactionId
): AllianceTermsView | null {
  const state = events.reduce(reducer, getInitialState())
  return buildAllianceTermsView(state, factionId)
}

// ----------------------------------------------------------------------------
// Legacy API Adapters
// ----------------------------------------------------------------------------

interface LegacyGameState {
  activeQuest: {
    questId: string
    alliances: Array<{ faction: FactionId; bountyShare: number }>
  } | null
  currentPhase: string
  ownedCards: Array<{ id: string }>
  reputation: Record<FactionId, number>
}

function fromLegacyState(legacyState: LegacyGameState): AllianceSliceState {
  return {
    activeQuestId: legacyState.activeQuest?.questId ?? null,
    currentPhase: legacyState.currentPhase,
    ownedCardCount: legacyState.ownedCards.length,
    reputation: legacyState.reputation,
    alliances: legacyState.activeQuest?.alliances.map(a => ({
      factionId: a.faction,
      bountyShare: a.bountyShare,
      cardIds: []
    })) ?? [],
    availableFactionIds: ['ironveil', 'ashfall', 'meridian', 'void_wardens', 'sundered_oath'],
    battleContext: 'Prepare for battle'
  }
}

export function projectAllianceOptions(
  events: GameEvent[],
  providedState?: LegacyGameState
): AllianceOptionsView | null {
  if (providedState) {
    const sliceState = fromLegacyState(providedState)
    return buildAllianceOptionsView(sliceState)
  }
  return projectAllianceOptionsFromEvents(events)
}

export function projectAllianceTermsView(
  events: GameEvent[],
  factionId: FactionId,
  providedState?: LegacyGameState
): AllianceTermsView | null {
  if (providedState) {
    const sliceState = fromLegacyState(providedState)
    return buildAllianceTermsView(sliceState, factionId)
  }
  return projectAllianceTermsFromEvents(events, factionId)
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function getStatForProfile(profile: string, stat: 'attack' | 'armor' | 'agility'): number {
  const profiles: Record<string, Record<string, number>> = {
    'Siege': { attack: 5, armor: 4, agility: 1 },
    'Interceptor': { attack: 3, armor: 2, agility: 5 },
    'Balanced': { attack: 3, armor: 4, agility: 3 },
    'Tank': { attack: 1, armor: 7, agility: 2 },
    'Glass Cannon': { attack: 6, armor: 2, agility: 2 }
  }

  return profiles[profile]?.[stat] ?? 3
}
