// ============================================================================
// BATTLE-RESOLUTION SLICE - Public API
// ============================================================================
//
// Exports read model for viewing battle progress.
//
// Note: Battle execution is triggered by LOCK_ORDERS in the deployment slice.
// This slice provides the read model for displaying battle results.
// ============================================================================

// Read model exports
export {
  createBattleProjection,
  buildBattleView,
  projectBattleFromEvents,
  TOTAL_ROUNDS,
  // Legacy API re-exports for backward compatibility
  projectBattleView,
  projectBattleResultView
} from './read-model'

export type {
  BattleView,
  BattleCardView,
  CombatRollView,
  RoundResultView
} from './read-model'
