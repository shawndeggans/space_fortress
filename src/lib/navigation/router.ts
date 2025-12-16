// ============================================================================
// SPACE FORTRESS - Navigation Router
// ============================================================================
//
// Centralized navigation system that maps game phases to routes.
// This is the single source of truth for phase-to-route mapping.
//
// Benefits:
// - Prevents 404 errors from mismatched phase/route names
// - Testable: Unit tests validate every phase has a route
// - Maintainable: Add new phases in one place
// ============================================================================

import { goto } from '$app/navigation'
import type { GamePhase } from '$lib/game/types'

// ----------------------------------------------------------------------------
// Phase-to-Route Mapping
// ----------------------------------------------------------------------------

/**
 * Single source of truth: every navigable phase maps to exactly one route.
 * If a phase should not navigate (e.g., intermediate states), set to null.
 */
export const PHASE_ROUTES: Record<GamePhase, string | null> = {
  not_started: '/',
  quest_hub: '/quest-hub',
  narrative: '/narrative',
  choice_consequence: '/choice-consequence',
  alliance: '/alliance',
  mediation: '/mediation',
  card_selection: '/card-pool',
  deployment: '/deployment',
  battle: '/battle',
  consequence: '/consequence',
  post_battle_dilemma: '/narrative',  // Reuses narrative screen for post-battle choices
  quest_summary: '/quest-summary',
  ending: '/ending'
}

/**
 * All valid routes in the app (for validation).
 * Useful for testing and debugging.
 */
export const VALID_ROUTES = new Set(
  Object.values(PHASE_ROUTES).filter((r): r is string => r !== null)
)

// ----------------------------------------------------------------------------
// Navigation Functions
// ----------------------------------------------------------------------------

/**
 * Get the route for a given game phase.
 * Returns null if the phase has no associated route.
 */
export function getRouteForPhase(phase: GamePhase): string | null {
  return PHASE_ROUTES[phase] ?? null
}

/**
 * Navigate to the route for a given game phase.
 * Returns true if navigation succeeded, false if no route exists.
 */
export async function navigateToPhase(phase: GamePhase): Promise<boolean> {
  const route = getRouteForPhase(phase)
  if (!route) {
    console.error(`[Navigation] No route defined for phase: ${phase}`)
    return false
  }
  await goto(route)
  return true
}

/**
 * Check if a route is valid (exists in the phase mapping).
 */
export function isValidRoute(route: string): boolean {
  return VALID_ROUTES.has(route)
}

// ----------------------------------------------------------------------------
// Validation (for testing)
// ----------------------------------------------------------------------------

/**
 * All game phases that should have routes.
 * Used for validation testing.
 */
export const ALL_GAME_PHASES: GamePhase[] = [
  'not_started',
  'quest_hub',
  'narrative',
  'choice_consequence',
  'alliance',
  'mediation',
  'card_selection',
  'deployment',
  'battle',
  'consequence',
  'post_battle_dilemma',
  'quest_summary',
  'ending'
]

/**
 * Validate that all game phases have routes defined.
 * Returns validation result with list of missing phases.
 */
export function validatePhaseRoutes(): { valid: boolean; missing: GamePhase[] } {
  const missing = ALL_GAME_PHASES.filter(phase => PHASE_ROUTES[phase] === undefined)
  return {
    valid: missing.length === 0,
    missing
  }
}

/**
 * Get all routes that should exist in the app.
 * Useful for E2E testing all routes.
 */
export function getAllRoutes(): string[] {
  return Array.from(VALID_ROUTES)
}
