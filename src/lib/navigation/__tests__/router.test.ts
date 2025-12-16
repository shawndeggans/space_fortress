// ============================================================================
// SPACE FORTRESS - Navigation Router Tests
// ============================================================================
//
// Tests for the centralized navigation system.
// Ensures all game phases have valid routes and navigation functions work.
// ============================================================================

import { describe, it, expect } from 'vitest'
import {
  PHASE_ROUTES,
  VALID_ROUTES,
  ALL_GAME_PHASES,
  getRouteForPhase,
  isValidRoute,
  validatePhaseRoutes,
  getAllRoutes
} from '../router'
import type { GamePhase } from '$lib/game/types'

describe('Navigation Router', () => {
  describe('PHASE_ROUTES mapping', () => {
    it('every game phase has a route defined', () => {
      const { valid, missing } = validatePhaseRoutes()
      expect(valid).toBe(true)
      expect(missing).toEqual([])
    })

    it('all defined phases map to non-null routes', () => {
      // Every phase should have a route (no null values)
      for (const phase of ALL_GAME_PHASES) {
        const route = PHASE_ROUTES[phase]
        expect(route).not.toBeNull()
        expect(typeof route).toBe('string')
      }
    })

    it('includes all expected game phases', () => {
      const expectedPhases: GamePhase[] = [
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

      for (const phase of expectedPhases) {
        expect(PHASE_ROUTES[phase]).toBeDefined()
      }
    })
  })

  describe('getRouteForPhase', () => {
    it('returns correct routes for each phase', () => {
      expect(getRouteForPhase('not_started')).toBe('/')
      expect(getRouteForPhase('quest_hub')).toBe('/quest-hub')
      expect(getRouteForPhase('narrative')).toBe('/narrative')
      expect(getRouteForPhase('choice_consequence')).toBe('/choice-consequence')
      expect(getRouteForPhase('alliance')).toBe('/alliance')
      expect(getRouteForPhase('mediation')).toBe('/mediation')
      expect(getRouteForPhase('card_selection')).toBe('/card-pool')
      expect(getRouteForPhase('deployment')).toBe('/deployment')
      expect(getRouteForPhase('battle')).toBe('/battle')
      expect(getRouteForPhase('consequence')).toBe('/consequence')
      expect(getRouteForPhase('post_battle_dilemma')).toBe('/narrative')
      expect(getRouteForPhase('quest_summary')).toBe('/quest-summary')
      expect(getRouteForPhase('ending')).toBe('/ending')
    })

    it('returns null for invalid phase', () => {
      // @ts-expect-error - Testing invalid input
      expect(getRouteForPhase('nonexistent_phase')).toBeNull()
    })
  })

  describe('VALID_ROUTES', () => {
    it('contains all unique routes', () => {
      const expectedRoutes = [
        '/',
        '/quest-hub',
        '/narrative',
        '/choice-consequence',
        '/alliance',
        '/mediation',
        '/card-pool',
        '/deployment',
        '/battle',
        '/consequence',
        '/quest-summary',
        '/ending'
      ]

      for (const route of expectedRoutes) {
        expect(VALID_ROUTES.has(route)).toBe(true)
      }
    })

    it('does not contain null values', () => {
      expect(VALID_ROUTES.has(null as unknown as string)).toBe(false)
    })

    it('has correct count of unique routes', () => {
      // post_battle_dilemma reuses /narrative, so count should be 12
      // (13 phases - 1 shared route = 12 unique routes)
      expect(VALID_ROUTES.size).toBe(12)
    })
  })

  describe('isValidRoute', () => {
    it('returns true for valid routes', () => {
      expect(isValidRoute('/')).toBe(true)
      expect(isValidRoute('/quest-hub')).toBe(true)
      expect(isValidRoute('/mediation')).toBe(true)
      expect(isValidRoute('/card-pool')).toBe(true)
    })

    it('returns false for invalid routes', () => {
      expect(isValidRoute('/nonexistent')).toBe(false)
      expect(isValidRoute('/invalid-route')).toBe(false)
      expect(isValidRoute('')).toBe(false)
    })
  })

  describe('getAllRoutes', () => {
    it('returns all valid routes as array', () => {
      const routes = getAllRoutes()
      expect(Array.isArray(routes)).toBe(true)
      expect(routes.length).toBe(12)
      expect(routes).toContain('/')
      expect(routes).toContain('/mediation')
      expect(routes).toContain('/card-pool')
      expect(routes).toContain('/choice-consequence')
      expect(routes).toContain('/quest-summary')
    })
  })

  describe('validatePhaseRoutes', () => {
    it('returns valid=true when all phases have routes', () => {
      const result = validatePhaseRoutes()
      expect(result.valid).toBe(true)
      expect(result.missing).toHaveLength(0)
    })
  })

  describe('Phase-Route Consistency', () => {
    it('mediation phase has mediation route (prevents 404)', () => {
      // This is the specific bug we fixed
      const mediationRoute = getRouteForPhase('mediation')
      expect(mediationRoute).toBe('/mediation')
      expect(mediationRoute).not.toBe('/alliance') // Old incorrect behavior
    })

    it('all battle-related phases have distinct routes', () => {
      const cardSelectionRoute = getRouteForPhase('card_selection')
      const deploymentRoute = getRouteForPhase('deployment')
      const battleRoute = getRouteForPhase('battle')

      expect(cardSelectionRoute).toBe('/card-pool')
      expect(deploymentRoute).toBe('/deployment')
      expect(battleRoute).toBe('/battle')

      // All distinct
      expect(cardSelectionRoute).not.toBe(deploymentRoute)
      expect(deploymentRoute).not.toBe(battleRoute)
    })
  })
})
