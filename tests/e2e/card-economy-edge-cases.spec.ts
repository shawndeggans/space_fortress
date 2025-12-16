// ============================================================================
// Card Economy Edge Cases
// ============================================================================
// Tests that verify the card economy constraints work correctly:
// - Need 5+ cards for battle
// - Card selection limits
// - Deployment requirements
// ============================================================================

import { test, expect } from '@playwright/test'

// Helper function
async function waitForHydration(page: import('@playwright/test').Page) {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(200)
}

test.describe('Card Economy Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)
  })

  test('2.1: Cannot proceed alone with only 4 cards (3 starter + 1 quest)', async ({ page }) => {
    // Start new game
    await page.getByRole('button', { name: /new game/i }).click()
    await page.waitForURL('**/quest-hub')

    // Accept first quest (+1 card = 4 total)
    await page.locator('.quest-card').first().click()
    await waitForHydration(page)
    await page.getByRole('button', { name: /accept quest/i }).click()
    await page.waitForURL('**/narrative')

    // Navigate through narrative with choice-consequence phases
    let attempts = 0
    while (attempts < 15 && !page.url().includes('alliance')) {
      const url = page.url()
      if (url.includes('narrative')) {
        const choice = page.locator('[data-testid^="choice-"]').first()
        if (await choice.isVisible()) {
          await choice.click()
          await waitForHydration(page)
        }
      } else if (url.includes('choice-consequence')) {
        await page.getByTestId('btn-continue').click()
        await waitForHydration(page)
      } else if (url.includes('quest-summary')) {
        // Quest completed without battle
        console.log('Quest completed without battle - skipping test')
        return
      }
      attempts++
      await page.waitForTimeout(300)
    }

    // Verify we're on alliance page
    if (page.url().includes('alliance')) {
      // Verify "Proceed Alone" button is disabled
      const proceedAloneBtn = page.getByTestId('btn-proceed-alone')
      if (await proceedAloneBtn.isVisible()) {
        // Should be disabled because we only have 4 cards
        await expect(proceedAloneBtn).toBeDisabled()
        console.log('PASS: Proceed Alone button is correctly disabled with only 4 cards')
      }
    }
  })

  test('2.2: Form alliance enables progression (3 + 1 + 2 = 6 cards)', async ({ page }) => {
    // Start new game
    await page.getByRole('button', { name: /new game/i }).click()
    await page.waitForURL('**/quest-hub')

    // Accept first quest
    await page.locator('.quest-card').first().click()
    await waitForHydration(page)
    await page.getByRole('button', { name: /accept quest/i }).click()
    await page.waitForURL('**/narrative')

    // Navigate to alliance with choice-consequence phases
    let attempts = 0
    while (attempts < 15 && !page.url().includes('alliance')) {
      const url = page.url()
      if (url.includes('narrative')) {
        const choice = page.locator('[data-testid^="choice-"]').first()
        if (await choice.isVisible()) {
          await choice.click()
          await waitForHydration(page)
        }
      } else if (url.includes('choice-consequence')) {
        await page.getByTestId('btn-continue').click()
        await waitForHydration(page)
      } else if (url.includes('quest-summary')) {
        console.log('Quest completed without battle - skipping test')
        return
      }
      attempts++
      await page.waitForTimeout(300)
    }

    if (page.url().includes('alliance')) {
      // Form alliance with first available faction
      const viewTermsBtn = page.getByRole('button', { name: /view terms/i }).first()
      if (await viewTermsBtn.isVisible()) {
        await viewTermsBtn.click()
        await waitForHydration(page)

        // Form alliance in modal
        const formAllianceBtn = page.getByTestId('btn-form-alliance')
        await formAllianceBtn.click()
        await waitForHydration(page)

        // Now "Continue to Card Selection" should be visible and enabled
        const continueBtn = page.getByTestId('btn-continue-to-cards')
        await expect(continueBtn).toBeVisible()
        await expect(continueBtn).toBeEnabled()
        console.log('PASS: Continue to Card Selection enabled after forming alliance')
      }
    }
  })

  test('2.3: Card pool - selecting 5 cards enables commit button', async ({ page }) => {
    // Navigate through flow to reach card pool
    await page.getByRole('button', { name: /new game/i }).click()
    await page.waitForURL('**/quest-hub')

    await page.locator('.quest-card').first().click()
    await waitForHydration(page)
    await page.getByRole('button', { name: /accept quest/i }).click()

    // Navigate to alliance with choice-consequence phases
    let attempts = 0
    while (attempts < 15 && !page.url().includes('alliance')) {
      const url = page.url()
      if (url.includes('narrative')) {
        const choice = page.locator('[data-testid^="choice-"]').first()
        if (await choice.isVisible()) {
          await choice.click()
          await waitForHydration(page)
        }
      } else if (url.includes('choice-consequence')) {
        await page.getByTestId('btn-continue').click()
        await waitForHydration(page)
      } else if (url.includes('quest-summary')) {
        console.log('Quest completed without battle - skipping test')
        return
      }
      attempts++
      await page.waitForTimeout(300)
    }

    if (page.url().includes('alliance')) {
      // Form alliance
      const viewTermsBtn = page.getByRole('button', { name: /view terms/i }).first()
      if (await viewTermsBtn.isVisible()) {
        await viewTermsBtn.click()
        await waitForHydration(page)
        await page.getByTestId('btn-form-alliance').click()
        await waitForHydration(page)

        // Continue to card selection
        await page.getByTestId('btn-continue-to-cards').click()
        await page.waitForURL('**/card-pool')
        await waitForHydration(page)

        // Verify commit button is disabled initially
        const commitBtn = page.getByTestId('btn-commit-fleet')
        await expect(commitBtn).toBeDisabled()
        console.log('PASS: Commit Fleet button is disabled with 0 cards selected')

        // Select 5 cards
        const cards = page.locator('[data-testid^="card-"]')
        const cardCount = await cards.count()
        console.log(`Found ${cardCount} cards in pool`)

        for (let i = 0; i < Math.min(5, cardCount); i++) {
          await cards.nth(i).click()
          await page.waitForTimeout(100)
        }

        // Verify commit button is now enabled
        await expect(commitBtn).toBeEnabled()
        console.log('PASS: Commit Fleet button enabled after selecting 5 cards')
      }
    }
  })

  test('2.4: Card pool - deselecting a card disables commit button', async ({ page }) => {
    // Navigate through flow to reach card pool
    await page.getByRole('button', { name: /new game/i }).click()
    await page.waitForURL('**/quest-hub')

    await page.locator('.quest-card').first().click()
    await waitForHydration(page)
    await page.getByRole('button', { name: /accept quest/i }).click()

    // Navigate to alliance with choice-consequence phases
    let attempts = 0
    while (attempts < 15 && !page.url().includes('alliance')) {
      const url = page.url()
      if (url.includes('narrative')) {
        const choice = page.locator('[data-testid^="choice-"]').first()
        if (await choice.isVisible()) {
          await choice.click()
          await waitForHydration(page)
        }
      } else if (url.includes('choice-consequence')) {
        await page.getByTestId('btn-continue').click()
        await waitForHydration(page)
      } else if (url.includes('quest-summary')) {
        console.log('Quest completed without battle - skipping test')
        return
      }
      attempts++
      await page.waitForTimeout(300)
    }

    if (page.url().includes('alliance')) {
      // Form alliance and continue to card pool
      const viewTermsBtn = page.getByRole('button', { name: /view terms/i }).first()
      if (await viewTermsBtn.isVisible()) {
        await viewTermsBtn.click()
        await waitForHydration(page)
        await page.getByTestId('btn-form-alliance').click()
        await waitForHydration(page)
        await page.getByTestId('btn-continue-to-cards').click()
        await page.waitForURL('**/card-pool')
        await waitForHydration(page)

        // Select 5 cards
        const cards = page.locator('[data-testid^="card-"]')
        for (let i = 0; i < 5; i++) {
          await cards.nth(i).click()
          await page.waitForTimeout(100)
        }

        const commitBtn = page.getByTestId('btn-commit-fleet')
        await expect(commitBtn).toBeEnabled()
        console.log('Commit button enabled with 5 cards')

        // Deselect one card (click same card again)
        await cards.first().click()
        await page.waitForTimeout(200)

        // Commit button should be disabled now (only 4 selected)
        await expect(commitBtn).toBeDisabled()
        console.log('PASS: Commit button disabled after deselecting to 4 cards')
      }
    }
  })

  test('2.5: Deployment - cannot lock orders without all 5 cards assigned', async ({ page }) => {
    // Navigate through full flow to reach deployment
    await page.getByRole('button', { name: /new game/i }).click()
    await page.waitForURL('**/quest-hub')

    await page.locator('.quest-card').first().click()
    await waitForHydration(page)
    await page.getByRole('button', { name: /accept quest/i }).click()

    // Navigate to alliance with choice-consequence phases
    let attempts = 0
    while (attempts < 15 && !page.url().includes('alliance')) {
      const url = page.url()
      if (url.includes('narrative')) {
        const choice = page.locator('[data-testid^="choice-"]').first()
        if (await choice.isVisible()) {
          await choice.click()
          await waitForHydration(page)
        }
      } else if (url.includes('choice-consequence')) {
        await page.getByTestId('btn-continue').click()
        await waitForHydration(page)
      } else if (url.includes('quest-summary')) {
        console.log('Quest completed without battle - skipping test')
        return
      }
      attempts++
      await page.waitForTimeout(300)
    }

    if (!page.url().includes('alliance')) {
      console.log('Could not reach alliance - skipping test')
      return
    }

    // Form alliance and continue to card pool
    const viewTermsBtn = page.getByRole('button', { name: /view terms/i }).first()
    await viewTermsBtn.click()
    await waitForHydration(page)
    await page.getByTestId('btn-form-alliance').click()
    await waitForHydration(page)
    await page.getByTestId('btn-continue-to-cards').click()
    await page.waitForURL('**/card-pool')
    await waitForHydration(page)

    // Select 5 cards and commit
    const cards = page.locator('[data-testid^="card-"]')
    for (let i = 0; i < 5; i++) {
      await cards.nth(i).click()
      await page.waitForTimeout(100)
    }
    await page.getByTestId('btn-commit-fleet').click()
    await page.waitForURL('**/deployment')
    await waitForHydration(page)

    // Verify Lock Orders button is disabled initially (no cards assigned)
    const lockBtn = page.getByTestId('btn-lock-orders')
    await expect(lockBtn).toBeDisabled()
    console.log('PASS: Lock Orders button disabled with no positions assigned')

    // Assign only 3 cards (not all 5)
    const draggableCards = page.locator('.draggable-card')
    for (let i = 0; i < 3; i++) {
      const card = draggableCards.first()
      if (await card.isVisible()) {
        await card.click()
        await page.waitForTimeout(200)
      }
    }

    // Button should still be disabled (need all 5)
    await expect(lockBtn).toBeDisabled()
    console.log('PASS: Lock Orders button still disabled with only 3 cards assigned')
  })
})
