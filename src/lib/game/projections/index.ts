// ============================================================================
// SPACE FORTRESS - Read Model Projections Index
// ============================================================================
//
// This module exports all screen-specific read model projections.
// Each projection is a pure function that transforms events into view data.
//
// Pattern: (events: GameEvent[]) => ViewData
// ============================================================================

// Re-export from main projections module
export { evolveState, getInitialState, rebuildState } from '../projections'

// Core UI projections
export { projectPlayerState } from './playerState'
export type { PlayerStateView } from './playerState'

// Quest list projections - now from accept-quest slice
export { projectQuestList, projectQuestDetail } from '../../slices/accept-quest'
export type { QuestListView, QuestDetailView } from '../../slices/accept-quest'

export { projectDilemmaView } from './dilemmaView'
export type { DilemmaViewData } from './dilemmaView'

export { projectCardPoolView } from './cardPool'
export type { CardPoolView } from './cardPool'

export { projectDeploymentView } from './deploymentView'
export type { DeploymentViewData } from './deploymentView'

export { projectBattleView, projectBattleResultView } from './battleView'
export type { BattleViewData, BattleResultViewData } from './battleView'

export { projectConsequenceView } from './consequenceView'
export type { ConsequenceViewData } from './consequenceView'

// Extended system projections
export { projectAllianceOptions, projectAllianceTermsView } from './allianceView'
export type { AllianceOptionsView, AllianceTermsViewData } from './allianceView'

export { projectMediationView } from './mediationView'
export type { MediationViewData } from './mediationView'

export { projectReputationDashboard, projectFactionDetailView } from './reputationView'
export type { ReputationDashboardView, FactionDetailViewData } from './reputationView'

// Endgame projections
export { projectEndingView } from './endingView'
export type { EndingViewData } from './endingView'

export { projectChoiceArchaeologyView } from './choiceArchaeology'
export type { ChoiceArchaeologyView } from './choiceArchaeology'

export { projectNavigationView } from './navigationView'
export type { NavigationView, PhaseStep, DisplayPhase, ReputationSummary, QuestProgress } from './navigationView'
