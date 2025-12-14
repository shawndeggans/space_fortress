// ============================================================================
// SPACE FORTRESS - Content Index
// ============================================================================

// Factions
export {
  factions,
  factionNpcs,
  areFactionsInConflict,
  getConflictReputationEffect,
  getNpcById,
  getFactionNpcs,
  getAllFactionIds
} from './factions'
export type { FactionNpc } from './factions'

// Cards
export {
  allCards,
  playerAcquirableCards,
  enemyCards,
  getCardById,
  getCardsByFaction,
  getStarterDeck,
  getStarterCardIds,
  getCardsByIds,
  generateScavengerFleet,
  generatePirateFleet,
  calculateFleetPower,
  getCardStatSummary
} from './cards'
export type { CardStatSummary } from './cards'

// Quests
export {
  allQuests,
  allDilemmas,
  quest1,
  quest2,
  quest3,
  getQuestById,
  getDilemmaById,
  getQuestDilemmas,
  getQuestFirstDilemma,
  getNextDilemma,
  getAvailableQuests,
  getLockedQuests
} from './quests'

// Endings
export {
  determineEnding,
  getEndingStats,
  getFactionStandings,
  getEndingTeaser
} from './endings'
export type { EndingStatDisplay, FactionStanding } from './endings'
