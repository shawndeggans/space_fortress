// ============================================================================
// SPACE FORTRESS - Navigation Module
// ============================================================================
//
// Centralized navigation exports.
// Import from '$lib/navigation' to access all navigation utilities.
// ============================================================================

export {
  // Constants
  PHASE_ROUTES,
  VALID_ROUTES,
  ALL_GAME_PHASES,

  // Functions
  getRouteForPhase,
  navigateToPhase,
  isValidRoute,
  validatePhaseRoutes,
  getAllRoutes
} from './router'
