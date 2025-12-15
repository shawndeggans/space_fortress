/**
 * Navigation Tests for Space Fortress
 *
 * These tests verify that all routes are accessible and don't return 404.
 * This prevents navigation errors like the /mediation 404 bug.
 */
import { test, expect } from '@playwright/test'

// All routes that should exist in the app
const ALL_ROUTES = [
  '/',
  '/quest-hub',
  '/narrative',
  '/alliance',
  '/mediation',
  '/card-pool',
  '/deployment',
  '/battle',
  '/consequence',
  '/ending'
]

test.describe('Route Accessibility', () => {
  test('all game routes return 200 (no 404 errors)', async ({ page }) => {
    for (const route of ALL_ROUTES) {
      const response = await page.goto(route)

      // Route should not 404
      expect(
        response?.status(),
        `Route ${route} returned ${response?.status()}`
      ).not.toBe(404)

      // Route should be 200 (OK)
      expect(
        response?.status(),
        `Route ${route} should return 200`
      ).toBe(200)
    }
  })

  test('mediation route exists and is accessible', async ({ page }) => {
    // This is the specific bug fix - /mediation was 404
    const response = await page.goto('/mediation')
    expect(response?.status()).toBe(200)

    // Page should render content (h1 with mediation, h2 with "No Active Mediation" fallback)
    await expect(page.locator('h1, h2').first()).toBeVisible()
  })

  test('card-pool route exists (maps to card_selection phase)', async ({ page }) => {
    const response = await page.goto('/card-pool')
    expect(response?.status()).toBe(200)
  })
})

test.describe('Navigation from Main Menu', () => {
  test('main menu loads at root', async ({ page }) => {
    await page.goto('/')

    // Should show game title
    await expect(page.locator('h1')).toContainText('Space Fortress')

    // Should have New Game button
    await expect(page.locator('[data-testid="btn-new-game"]')).toBeVisible()
  })
})

test.describe('Phase-based Navigation', () => {
  test('game phases correspond to correct routes', async ({ page }) => {
    // Map of phases to expected routes
    const phaseRouteMap: Record<string, string> = {
      not_started: '/',
      quest_hub: '/quest-hub',
      narrative: '/narrative',
      alliance: '/alliance',
      mediation: '/mediation',
      card_selection: '/card-pool',
      deployment: '/deployment',
      battle: '/battle',
      consequence: '/consequence',
      ending: '/ending'
    }

    // Verify each route loads
    for (const [phase, route] of Object.entries(phaseRouteMap)) {
      const response = await page.goto(route)
      expect(
        response?.status(),
        `Phase ${phase} route ${route} should be accessible`
      ).toBe(200)
    }
  })
})
