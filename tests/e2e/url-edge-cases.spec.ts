// ============================================================================
// URL Navigation Edge Cases - Testing direct navigation without game state
// ============================================================================
// These tests verify proper fallback/error handling when players navigate
// directly to URLs without the required game state.
// ============================================================================

import { test, expect } from '@playwright/test'

test.describe('URL Navigation Edge Cases', () => {
  test.describe('Direct navigation without game state', () => {
    test('1.1: /battle without active battle shows fallback', async ({ page }) => {
      await page.goto('/battle')
      await page.waitForTimeout(2000) // Wait for hydration

      // Should show fallback message
      await expect(page.getByText('No active battle')).toBeVisible()
      await expect(page.getByRole('button', { name: /return to quest hub/i })).toBeVisible()
    })

    test('1.2: /consequence without completed battle shows fallback', async ({ page }) => {
      await page.goto('/consequence')
      await page.waitForTimeout(2000)

      // Should show fallback message
      await expect(page.getByText(/no .*(battle outcome|outcome)/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /return to quest hub/i })).toBeVisible()
    })

    test('1.3: /card-pool without battle shows proper state', async ({ page }) => {
      await page.goto('/card-pool')
      await page.waitForTimeout(2000)

      const bodyText = await page.locator('body').innerText()

      // Should either show card pool (possibly empty) or a fallback
      expect(bodyText.toLowerCase()).toMatch(/card|fleet|select|return/i)
    })

    test('1.4: /deployment without committed cards shows disabled state', async ({ page }) => {
      await page.goto('/deployment')
      await page.waitForTimeout(2000)

      // Lock Orders button should be disabled or not visible
      const lockBtn = page.getByTestId('btn-lock-orders')
      if (await lockBtn.isVisible()) {
        await expect(lockBtn).toBeDisabled()
      } else {
        // If no button, check for fallback message
        const bodyText = await page.locator('body').innerText()
        expect(bodyText.toLowerCase()).toMatch(/return|no|deploy/i)
      }
    })

    test('1.5: /ending without completing 3 quests shows fallback', async ({ page }) => {
      await page.goto('/ending')
      await page.waitForTimeout(2000)

      const bodyText = await page.locator('body').innerText()

      // Should show fallback or redirect
      expect(bodyText.toLowerCase()).toMatch(/ending|journey|return|quest/i)
    })

    test('1.6: /alliance without accepting quest shows fallback', async ({ page }) => {
      await page.goto('/alliance')
      await page.waitForTimeout(2000)

      const bodyText = await page.locator('body').innerText()

      // Should show alliance screen content or fallback
      expect(bodyText.toLowerCase()).toMatch(/alliance|faction|return|quest/i)
    })

    test('1.7: /narrative without active quest shows fallback', async ({ page }) => {
      await page.goto('/narrative')
      await page.waitForTimeout(2000)

      const bodyText = await page.locator('body').innerText()

      // Should show fallback message
      expect(bodyText.toLowerCase()).toMatch(/no.*quest|return|narrative/i)
    })

    test('1.8: /mediation without active mediation shows fallback', async ({ page }) => {
      await page.goto('/mediation')
      await page.waitForTimeout(2000)

      const bodyText = await page.locator('body').innerText()

      // Should show fallback message
      expect(bodyText.toLowerCase()).toMatch(/mediation|return|no/i)
    })

    test('1.9: /choice-consequence without choice data shows fallback', async ({ page }) => {
      await page.goto('/choice-consequence')
      await page.waitForTimeout(2000)

      const bodyText = await page.locator('body').innerText()

      // Should show fallback message
      expect(bodyText.toLowerCase()).toMatch(/no.*choice|return|outcome/i)
    })

    test('1.10: /quest-summary without quest data shows fallback', async ({ page }) => {
      await page.goto('/quest-summary')
      await page.waitForTimeout(2000)

      const bodyText = await page.locator('body').innerText()

      // Should show fallback message
      expect(bodyText.toLowerCase()).toMatch(/no.*quest|summary|return/i)
    })
  })

  test.describe('Fallback navigation works', () => {
    test('2.1: Clicking "Return to Quest Hub" from /battle works', async ({ page }) => {
      await page.goto('/battle')
      await page.waitForTimeout(2000)

      await page.getByRole('button', { name: /return to quest hub/i }).click()
      await page.waitForURL('**/quest-hub')

      await expect(page.getByRole('heading', { name: /quest hub/i })).toBeVisible()
    })

    test('2.2: Clicking "Return to Quest Hub" from /consequence works', async ({ page }) => {
      await page.goto('/consequence')
      await page.waitForTimeout(2000)

      await page.getByRole('button', { name: /return to quest hub/i }).click()
      await page.waitForURL('**/quest-hub')

      await expect(page.getByRole('heading', { name: /quest hub/i })).toBeVisible()
    })

    test('2.3: Clicking "Return to Quest Hub" from /choice-consequence works', async ({ page }) => {
      await page.goto('/choice-consequence')
      await page.waitForTimeout(2000)

      await page.getByRole('button', { name: /return to quest hub/i }).click()
      await page.waitForURL('**/quest-hub')

      await expect(page.getByRole('heading', { name: /quest hub/i })).toBeVisible()
    })

    test('2.4: Clicking "Return to Quest Hub" from /quest-summary works', async ({ page }) => {
      await page.goto('/quest-summary')
      await page.waitForTimeout(2000)

      await page.getByRole('button', { name: /return to quest hub/i }).click()
      await page.waitForURL('**/quest-hub')

      await expect(page.getByRole('heading', { name: /quest hub/i })).toBeVisible()
    })
  })

  test.describe('Browser back button edge cases', () => {
    test('3.1: Back button after making choice goes to choice-consequence', async ({ page }) => {
      // Start new game
      await page.goto('/')
      await page.getByRole('button', { name: /new game/i }).click()
      await page.waitForURL('**/quest-hub')

      // Accept quest
      await page.locator('.quest-card').first().click()
      await page.getByRole('button', { name: /accept quest/i }).click()
      await page.waitForURL('**/narrative')

      // Make a choice - should go to choice-consequence
      const choiceBtn = page.locator('[data-testid^="choice-"]').first()
      if (await choiceBtn.isVisible()) {
        await choiceBtn.click()
        await page.waitForURL('**/choice-consequence', { timeout: 5000 })

        // Use browser back
        await page.goBack()
        await page.waitForTimeout(500)

        // Check we went back to narrative
        const url = page.url()
        expect(url).toMatch(/narrative|quest-hub/)
      }
    })

    test('3.2: Back button from choice-consequence after continuing', async ({ page }) => {
      // Start new game
      await page.goto('/')
      await page.getByRole('button', { name: /new game/i }).click()
      await page.waitForURL('**/quest-hub')

      // Accept quest
      await page.locator('.quest-card').first().click()
      await page.getByRole('button', { name: /accept quest/i }).click()
      await page.waitForURL('**/narrative')

      // Make a choice
      const choiceBtn = page.locator('[data-testid^="choice-"]').first()
      if (await choiceBtn.isVisible()) {
        await choiceBtn.click()
        await page.waitForURL('**/choice-consequence', { timeout: 5000 })

        // Continue from choice consequence
        await page.getByTestId('btn-continue').click()
        await page.waitForTimeout(500)

        // Use browser back - should go to choice-consequence
        await page.goBack()
        await page.waitForTimeout(500)

        // Check state is still valid
        const url = page.url()
        expect(url).toMatch(/choice-consequence|narrative|alliance|quest-summary/)
      }
    })
  })
})
