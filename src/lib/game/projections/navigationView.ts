// ============================================================================
// SPACE FORTRESS - Navigation View Projection
// ============================================================================
//
// Projects navigation state from game state for the header and menu components.
// Determines visibility, phase tracking, and available actions.
// ============================================================================

import type { GameState, GamePhase, FactionId, ReputationStatus } from '../types'
import { getReputationStatus } from '../types'

// ----------------------------------------------------------------------------
// Display Phase - Simplified phases for UI display
// ----------------------------------------------------------------------------

export type DisplayPhase = 'quest_hub' | 'narrative' | 'alliance' | 'battle' | 'result'

// Map GamePhase to DisplayPhase for simplified UI
const PHASE_MAPPING: Record<GamePhase, DisplayPhase | null> = {
  not_started: null,
  quest_hub: 'quest_hub',
  narrative: 'narrative',
  choice_consequence: 'narrative',  // Shows consequence after choice
  alliance: 'alliance',
  mediation: 'alliance',
  card_selection: 'battle',
  deployment: 'battle',
  battle: 'battle',
  consequence: 'result',
  post_battle_dilemma: 'narrative',
  quest_summary: 'result',  // Shows summary at quest end
  ending: 'result'
}

// Display labels for phases
const PHASE_LABELS: Record<DisplayPhase, string> = {
  quest_hub: 'Quest Hub',
  narrative: 'Narrative',
  alliance: 'Alliance',
  battle: 'Battle',
  result: 'Result'
}

// Phase order for progress indicator
const PHASE_ORDER: DisplayPhase[] = ['quest_hub', 'narrative', 'alliance', 'battle', 'result']

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface PhaseStep {
  phase: DisplayPhase
  label: string
  status: 'completed' | 'current' | 'upcoming'
}

export interface ReputationSummary {
  factionId: FactionId
  value: number
  status: ReputationStatus
}

export interface QuestProgress {
  title: string
  factionId: FactionId
  current: number
  total: number
}

export interface NavigationView {
  // Header visibility
  showHeader: boolean

  // Current game phase
  currentPhase: GamePhase
  displayPhase: DisplayPhase | null

  // Quest progress (if in quest)
  questProgress: QuestProgress | null
  questsCompleted: number
  maxQuests: number

  // Phase indicator steps
  phaseSteps: PhaseStep[]

  // Economy
  bounty: number

  // Reputation summary
  reputations: ReputationSummary[]

  // Menu options
  canSave: boolean
  canLoad: boolean
  canReturnToMenu: boolean
}

// ----------------------------------------------------------------------------
// Projection Function
// ----------------------------------------------------------------------------

export function projectNavigationView(state: GameState): NavigationView {
  const currentPhase = state.currentPhase
  const displayPhase = PHASE_MAPPING[currentPhase]

  // Don't show header on main menu or when game not started
  const showHeader = currentPhase !== 'not_started'

  // Build phase steps
  const phaseSteps = buildPhaseSteps(displayPhase, currentPhase)

  // Build quest progress
  const questProgress = buildQuestProgress(state)

  // Build reputation summary
  const reputations = buildReputationSummary(state)

  return {
    showHeader,
    currentPhase,
    displayPhase,
    questProgress,
    questsCompleted: state.completedQuests.length,
    maxQuests: 3,
    phaseSteps,
    bounty: state.bounty,
    reputations,
    canSave: state.gameStatus === 'in_progress',
    canLoad: true,
    canReturnToMenu: true
  }
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

function buildPhaseSteps(displayPhase: DisplayPhase | null, gamePhase: GamePhase): PhaseStep[] {
  if (!displayPhase) {
    return []
  }

  const currentIndex = PHASE_ORDER.indexOf(displayPhase)

  return PHASE_ORDER.map((phase, index) => {
    let status: 'completed' | 'current' | 'upcoming'

    if (index < currentIndex) {
      status = 'completed'
    } else if (index === currentIndex) {
      status = 'current'
    } else {
      status = 'upcoming'
    }

    return {
      phase,
      label: PHASE_LABELS[phase],
      status
    }
  })
}

function buildQuestProgress(state: GameState): QuestProgress | null {
  if (!state.activeQuest) {
    return null
  }

  // We need to get quest title from somewhere - for now use questId
  // In a real implementation, we'd import from quests content
  const questId = state.activeQuest.questId
  const title = formatQuestTitle(questId)

  // Get faction from quest - we'll need to derive this
  // For now, extract from questId pattern
  const factionId = inferFactionFromQuestId(questId)

  return {
    title,
    factionId,
    current: state.activeQuest.dilemmasCompleted + 1,
    total: 3 // Most quests have 3 dilemmas
  }
}

function formatQuestTitle(questId: string): string {
  // Convert quest_salvage_claim to "Salvage Claim"
  return questId
    .replace('quest_', '')
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function inferFactionFromQuestId(questId: string): FactionId {
  // Default faction mapping for known quests
  const questFactions: Record<string, FactionId> = {
    quest_salvage_claim: 'ironveil',
    quest_sanctuary_run: 'meridian',
    quest_brokers_gambit: 'ashfall'
  }

  return questFactions[questId] || 'ironveil'
}

function buildReputationSummary(state: GameState): ReputationSummary[] {
  const factions: FactionId[] = ['ironveil', 'ashfall', 'meridian', 'void_wardens', 'sundered_oath']

  return factions.map(factionId => ({
    factionId,
    value: state.reputation[factionId] || 0,
    status: getReputationStatus(state.reputation[factionId] || 0)
  }))
}
