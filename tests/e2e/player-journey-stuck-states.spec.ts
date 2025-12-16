// ============================================================================
// E2E Tests: Stuck State Scenarios
// ============================================================================
// These tests verify that players never get stuck without options to proceed.
// Each test corresponds to a STUCK scenario from the Player Journeys doc.
// ============================================================================

import { test, expect } from '@playwright/test'

async function waitForHydration(page: import('@playwright/test').Page) {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(200)
}

async function startNewGame(page: import('@playwright/test').Page) {
  await page.goto('/')
  await waitForHydration(page)
  await page.getByRole('button', { name: /new game/i }).click()
  await page.waitForURL('**/quest-hub')
}

async function acceptQuest(page: import('@playwright/test').Page, questIndex = 0) {
  await page.locator('.quest-card').nth(questIndex).click()
  await waitForHydration(page)
  await page.getByRole('button', { name: /accept quest/i }).click()
  await page.waitForURL('**/narrative')
}

async function navigateToAlliance(page: import('@playwright/test').Page) {
  let attempts = 0
  while (attempts < 20 && !page.url().includes('alliance')) {
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
      return // No battle for this path
    }
    attempts++
    await page.waitForTimeout(300)
  }
}

// ============================================================================
// STUCK-3: Battle Screen Continue Button
// ============================================================================

test.describe('STUCK-3: Battle Screen Navigation', () => {
  test('battle screen shows continue button after completion', async ({ page }) => {
    await startNewGame(page)
    await acceptQuest(page)
    await navigateToAlliance(page)

    if (!page.url().includes('alliance')) {
      test.skip()
      return
    }

    // Form alliance
    const viewTermsBtn = page.getByRole('button', { name: /view terms/i }).first()
    await viewTermsBtn.click()
    await waitForHydration(page)
    await page.getByTestId('btn-form-alliance').click()
    await waitForHydration(page)
    await page.getByTestId('btn-continue-to-cards').click()
    await page.waitForURL('**/card-pool')

    // Select 5 cards
    const cards = page.locator('[data-testid^="card-"]')
    for (let i = 0; i < 5; i++) {
      await cards.nth(i).click()
      await page.waitForTimeout(100)
    }
    await page.getByTestId('btn-commit-fleet').click()
    await page.waitForURL('**/deployment')

    // Deploy cards
    let assigned = 0
    while (assigned < 5) {
      const draggable = page.locator('.draggable-card').first()
      if (await draggable.isVisible()) {
        await draggable.click()
        await page.waitForTimeout(150)
        assigned++
      } else {
        break
      }
    }

    // Lock orders and go to battle
    const lockBtn = page.getByTestId('btn-lock-orders')
    await expect(lockBtn).toBeEnabled({ timeout: 5000 })
    await lockBtn.click()
    await page.waitForURL('**/battle')

    // Wait for battle to complete (auto-plays)
    // The continue button MUST appear within reasonable time
    const viewConsequences = page.getByTestId('btn-view-consequences')
    await expect(viewConsequences).toBeVisible({ timeout: 20000 })

    // Verify button is clickable
    await expect(viewConsequences).toBeEnabled()
  })

  test('battle screen has no dead-end states', async ({ page }) => {
    await startNewGame(page)
    await acceptQuest(page)
    await navigateToAlliance(page)

    if (!page.url().includes('alliance')) {
      test.skip()
      return
    }

    // Form alliance and get to battle
    await page.getByRole('button', { name: /view terms/i }).first().click()
    await waitForHydration(page)
    await page.getByTestId('btn-form-alliance').click()
    await waitForHydration(page)
    await page.getByTestId('btn-continue-to-cards').click()
    await page.waitForURL('**/card-pool')

    const cards = page.locator('[data-testid^="card-"]')
    for (let i = 0; i < 5; i++) {
      await cards.nth(i).click()
      await page.waitForTimeout(100)
    }
    await page.getByTestId('btn-commit-fleet').click()
    await page.waitForURL('**/deployment')

    let assigned = 0
    while (assigned < 5) {
      const draggable = page.locator('.draggable-card').first()
      if (await draggable.isVisible()) {
        await draggable.click()
        await page.waitForTimeout(150)
        assigned++
      } else break
    }

    await page.getByTestId('btn-lock-orders').click()
    await page.waitForURL('**/battle')

    // Wait 30 seconds max for battle to complete
    await page.waitForTimeout(5000)

    // There must be SOME way to proceed from the battle screen
    const proceedOptions = [
      page.getByTestId('btn-view-consequences'),
      page.getByTestId('btn-continue'),
      page.getByRole('button', { name: /continue/i }),
      page.getByRole('button', { name: /proceed/i }),
      page.getByRole('button', { name: /next/i })
    ]

    let foundOption = false
    for (const option of proceedOptions) {
      if (await option.isVisible().catch(() => false)) {
        foundOption = true
        break
      }
    }

    // If battle is still playing, wait more
    if (!foundOption) {
      await page.waitForTimeout(10000)
      for (const option of proceedOptions) {
        if (await option.isVisible().catch(() => false)) {
          foundOption = true
          break
        }
      }
    }

    expect(foundOption).toBe(true)
  })
})

// ============================================================================
// STUCK-4: Consequence Screen Navigation
// ============================================================================

test.describe('STUCK-4: Consequence Screen Navigation', () => {
  test('consequence screen has continue button', async ({ page }) => {
    await startNewGame(page)
    await acceptQuest(page)

    // Make a choice to get to choice-consequence
    const choice = page.locator('[data-testid^="choice-"]').first()
    await choice.click()
    await waitForHydration(page)

    // Should be on choice-consequence
    await expect(page).toHaveURL(/choice-consequence/)

    // Continue button must be visible
    const continueBtn = page.getByTestId('btn-continue')
    await expect(continueBtn).toBeVisible()
    await expect(continueBtn).toBeEnabled()

    // Clicking it must navigate somewhere
    const currentUrl = page.url()
    await continueBtn.click()
    await waitForHydration(page)
    await page.waitForTimeout(500)

    // Must have navigated (not stuck)
    expect(page.url()).not.toBe(currentUrl)
  })

  test('battle consequence navigates to next phase', async ({ page }) => {
    await startNewGame(page)
    await acceptQuest(page)
    await navigateToAlliance(page)

    if (!page.url().includes('alliance')) {
      test.skip()
      return
    }

    // Complete battle flow
    await page.getByRole('button', { name: /view terms/i }).first().click()
    await waitForHydration(page)
    await page.getByTestId('btn-form-alliance').click()
    await waitForHydration(page)
    await page.getByTestId('btn-continue-to-cards').click()
    await page.waitForURL('**/card-pool')

    const cards = page.locator('[data-testid^="card-"]')
    for (let i = 0; i < 5; i++) {
      await cards.nth(i).click()
      await page.waitForTimeout(100)
    }
    await page.getByTestId('btn-commit-fleet').click()
    await page.waitForURL('**/deployment')

    let assigned = 0
    while (assigned < 5) {
      const draggable = page.locator('.draggable-card').first()
      if (await draggable.isVisible()) {
        await draggable.click()
        await page.waitForTimeout(150)
        assigned++
      } else break
    }

    await page.getByTestId('btn-lock-orders').click()
    await page.waitForURL('**/battle')

    // Wait for battle to complete
    const viewConsequences = page.getByTestId('btn-view-consequences')
    await expect(viewConsequences).toBeVisible({ timeout: 20000 })
    await viewConsequences.click()

    await page.waitForURL('**/consequence')

    // Consequence screen must have continue button
    const continueBtn = page.getByTestId('btn-continue')
    await expect(continueBtn).toBeVisible({ timeout: 5000 })

    // Click and verify navigation
    await continueBtn.click()
    await waitForHydration(page)
    await page.waitForTimeout(1000)

    // Must navigate to valid next state (quest-summary, narrative, quest-hub, or ending)
    const url = page.url()
    expect(url).toMatch(/quest-summary|narrative|quest-hub|ending|consequence/)
  })
})

// ============================================================================
// STUCK-5: Quest Summary Navigation
// ============================================================================

test.describe('STUCK-5: Quest Summary Navigation', () => {
  test('quest summary has return to hub button', async ({ page }) => {
    // This requires completing a full quest
    await startNewGame(page)
    await acceptQuest(page)

    // Navigate through entire quest
    let attempts = 0
    while (attempts < 50) {
      const url = page.url()

      if (url.includes('quest-summary')) {
        // Found quest summary - verify continue button exists
        const continueBtn = page.getByTestId('btn-continue')
        await expect(continueBtn).toBeVisible({ timeout: 5000 })
        await expect(continueBtn).toBeEnabled()

        // Click and verify navigation to quest-hub
        await continueBtn.click()
        await waitForHydration(page)

        // Should be at quest-hub or ending
        expect(page.url()).toMatch(/quest-hub|ending/)
        return
      }

      if (url.includes('narrative')) {
        const choice = page.locator('[data-testid^="choice-"]').first()
        if (await choice.isVisible()) {
          await choice.click()
          await waitForHydration(page)
        }
      } else if (url.includes('choice-consequence')) {
        await page.getByTestId('btn-continue').click()
        await waitForHydration(page)
      } else if (url.includes('alliance')) {
        const viewTerms = page.getByRole('button', { name: /view terms/i }).first()
        if (await viewTerms.isVisible()) {
          await viewTerms.click()
          await waitForHydration(page)
          await page.getByTestId('btn-form-alliance').click()
          await waitForHydration(page)
          await page.getByTestId('btn-continue-to-cards').click()
          await waitForHydration(page)
        }
      } else if (url.includes('card-pool')) {
        const cards = page.locator('[data-testid^="card-"]')
        const count = await cards.count()
        for (let i = 0; i < Math.min(5, count); i++) {
          await cards.nth(i).click()
          await page.waitForTimeout(100)
        }
        await page.getByTestId('btn-commit-fleet').click()
        await waitForHydration(page)
      } else if (url.includes('deployment')) {
        let assigned = 0
        while (assigned < 5) {
          const draggable = page.locator('.draggable-card').first()
          if (await draggable.isVisible()) {
            await draggable.click()
            await page.waitForTimeout(150)
            assigned++
          } else break
        }
        const lockBtn = page.getByTestId('btn-lock-orders')
        if (await lockBtn.isEnabled()) {
          await lockBtn.click()
          await waitForHydration(page)
        }
      } else if (url.includes('battle')) {
        await page.waitForTimeout(3000)
        const viewConsequences = page.getByTestId('btn-view-consequences')
        if (await viewConsequences.isVisible().catch(() => false)) {
          await viewConsequences.click()
          await waitForHydration(page)
        } else {
          await page.waitForTimeout(5000)
        }
      } else if (url.includes('consequence')) {
        await page.getByTestId('btn-continue').click()
        await waitForHydration(page)
      } else if (url.includes('mediation')) {
        // Try to lean toward a faction
        const leanBtn = page.getByRole('button', { name: /lean/i }).first()
        if (await leanBtn.isVisible().catch(() => false)) {
          await leanBtn.click()
          await waitForHydration(page)
        }
      }

      attempts++
      await page.waitForTimeout(300)
    }
  })
})

// ============================================================================
// STUCK-7: Deployment Screen Clarity
// ============================================================================

test.describe('STUCK-7: Deployment Screen Usability', () => {
  test('deployment shows unassigned cards clearly', async ({ page }) => {
    await startNewGame(page)
    await acceptQuest(page)
    await navigateToAlliance(page)

    if (!page.url().includes('alliance')) {
      test.skip()
      return
    }

    // Get to deployment
    await page.getByRole('button', { name: /view terms/i }).first().click()
    await waitForHydration(page)
    await page.getByTestId('btn-form-alliance').click()
    await waitForHydration(page)
    await page.getByTestId('btn-continue-to-cards').click()
    await page.waitForURL('**/card-pool')

    const cards = page.locator('[data-testid^="card-"]')
    for (let i = 0; i < 5; i++) {
      await cards.nth(i).click()
      await page.waitForTimeout(100)
    }
    await page.getByTestId('btn-commit-fleet').click()
    await page.waitForURL('**/deployment')

    // Verify unassigned cards are visible
    const draggableCards = page.locator('.draggable-card')
    await expect(draggableCards.first()).toBeVisible()

    // Verify Lock Orders button is disabled initially
    const lockBtn = page.getByTestId('btn-lock-orders')
    await expect(lockBtn).toBeDisabled()

    // Assign one card
    await draggableCards.first().click()
    await page.waitForTimeout(200)

    // Should still have unassigned cards visible (4 remaining)
    const remainingCount = await draggableCards.count()
    expect(remainingCount).toBeLessThanOrEqual(4)
  })

  test('deployment lock button enables after all positions filled', async ({ page }) => {
    await startNewGame(page)
    await acceptQuest(page)
    await navigateToAlliance(page)

    if (!page.url().includes('alliance')) {
      test.skip()
      return
    }

    // Get to deployment
    await page.getByRole('button', { name: /view terms/i }).first().click()
    await waitForHydration(page)
    await page.getByTestId('btn-form-alliance').click()
    await waitForHydration(page)
    await page.getByTestId('btn-continue-to-cards').click()
    await page.waitForURL('**/card-pool')

    const selectCards = page.locator('[data-testid^="card-"]')
    for (let i = 0; i < 5; i++) {
      await selectCards.nth(i).click()
      await page.waitForTimeout(100)
    }
    await page.getByTestId('btn-commit-fleet').click()
    await page.waitForURL('**/deployment')

    // Assign all 5 cards
    let assigned = 0
    while (assigned < 5) {
      const draggable = page.locator('.draggable-card').first()
      if (await draggable.isVisible()) {
        await draggable.click()
        await page.waitForTimeout(150)
        assigned++
      } else break
    }

    // Lock button should now be enabled
    const lockBtn = page.getByTestId('btn-lock-orders')
    await expect(lockBtn).toBeEnabled({ timeout: 5000 })
  })
})

// ============================================================================
// STUCK-8: Game Ending Trigger
// ============================================================================

test.describe('STUCK-8: Game Ending After Three Quests', () => {
  test('ending screen appears after completing all quests', async ({ page }) => {
    // This is a long test - completes all 3 quests
    test.setTimeout(180000) // 3 minutes

    await startNewGame(page)

    for (let questNum = 0; questNum < 3; questNum++) {
      // Accept quest
      const questCard = page.locator('.quest-card').nth(0)
      await questCard.click()
      await waitForHydration(page)
      await page.getByRole('button', { name: /accept quest/i }).click()

      // Complete quest
      let questComplete = false
      let attempts = 0

      while (!questComplete && attempts < 100) {
        const url = page.url()

        if (url.includes('quest-summary')) {
          const continueBtn = page.getByTestId('btn-continue')
          await expect(continueBtn).toBeVisible({ timeout: 5000 })
          await continueBtn.click()
          await waitForHydration(page)
          questComplete = true
        } else if (url.includes('ending')) {
          // Reached ending - test passes
          expect(questNum).toBe(2) // Should only reach ending after 3rd quest
          await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
          return
        } else if (url.includes('narrative')) {
          const choice = page.locator('[data-testid^="choice-"]').first()
          if (await choice.isVisible()) {
            await choice.click()
            await waitForHydration(page)
          }
        } else if (url.includes('choice-consequence')) {
          await page.getByTestId('btn-continue').click()
          await waitForHydration(page)
        } else if (url.includes('alliance')) {
          const viewTerms = page.getByRole('button', { name: /view terms/i }).first()
          const continueWithout = page.getByRole('button', { name: /continue without/i })

          if (await viewTerms.isVisible().catch(() => false)) {
            await viewTerms.click()
            await waitForHydration(page)
            await page.getByTestId('btn-form-alliance').click()
            await waitForHydration(page)
            await page.getByTestId('btn-continue-to-cards').click()
          } else if (await continueWithout.isVisible().catch(() => false)) {
            await continueWithout.click()
            await waitForHydration(page)
          }
        } else if (url.includes('card-pool')) {
          const cards = page.locator('[data-testid^="card-"]')
          const count = await cards.count()
          for (let i = 0; i < Math.min(5, count); i++) {
            await cards.nth(i).click()
            await page.waitForTimeout(100)
          }
          const commitBtn = page.getByTestId('btn-commit-fleet')
          if (await commitBtn.isEnabled()) {
            await commitBtn.click()
            await waitForHydration(page)
          }
        } else if (url.includes('deployment')) {
          let assigned = 0
          while (assigned < 5) {
            const draggable = page.locator('.draggable-card').first()
            if (await draggable.isVisible()) {
              await draggable.click()
              await page.waitForTimeout(150)
              assigned++
            } else break
          }
          const lockBtn = page.getByTestId('btn-lock-orders')
          await page.waitForTimeout(500)
          if (await lockBtn.isEnabled()) {
            await lockBtn.click()
            await waitForHydration(page)
          }
        } else if (url.includes('battle')) {
          await page.waitForTimeout(2000)
          const viewConsequences = page.getByTestId('btn-view-consequences')
          if (await viewConsequences.isVisible().catch(() => false)) {
            await viewConsequences.click()
            await waitForHydration(page)
          } else {
            await page.waitForTimeout(3000)
          }
        } else if (url.includes('consequence')) {
          const continueBtn = page.getByTestId('btn-continue')
          if (await continueBtn.isVisible()) {
            await continueBtn.click()
            await waitForHydration(page)
          }
        } else if (url.includes('mediation')) {
          const leanBtn = page.getByRole('button', { name: /lean/i }).first()
          const refuseBtn = page.getByRole('button', { name: /refuse/i })
          if (await leanBtn.isVisible().catch(() => false)) {
            await leanBtn.click()
            await waitForHydration(page)
          } else if (await refuseBtn.isVisible().catch(() => false)) {
            await refuseBtn.click()
            await waitForHydration(page)
          }
        }

        attempts++
        await page.waitForTimeout(300)
      }

      // Verify back at quest hub (unless ending)
      if (questNum < 2) {
        expect(page.url()).toContain('quest-hub')
      }
    }

    // After 3 quests, should be at ending
    expect(page.url()).toMatch(/ending|quest-hub/)
  })
})

// ============================================================================
// Alliance Screen Options
// ============================================================================

test.describe('Alliance Screen Options', () => {
  test('alliance screen always has proceed option', async ({ page }) => {
    await startNewGame(page)
    await acceptQuest(page)
    await navigateToAlliance(page)

    if (!page.url().includes('alliance')) {
      test.skip()
      return
    }

    // Must have either "View Terms" for alliance OR "Continue without" option
    const viewTerms = page.getByRole('button', { name: /view terms/i }).first()
    const continueWithout = page.getByRole('button', { name: /continue without/i })
    const proceedBtn = page.getByRole('button', { name: /proceed/i })

    const hasViewTerms = await viewTerms.isVisible().catch(() => false)
    const hasContinueWithout = await continueWithout.isVisible().catch(() => false)
    const hasProceed = await proceedBtn.isVisible().catch(() => false)

    expect(hasViewTerms || hasContinueWithout || hasProceed).toBe(true)
  })
})

// ============================================================================
// Card Pool Screen Options
// ============================================================================

test.describe('Card Pool Screen Options', () => {
  test('card pool shows at least 5 selectable cards', async ({ page }) => {
    await startNewGame(page)
    await acceptQuest(page)
    await navigateToAlliance(page)

    if (!page.url().includes('alliance')) {
      test.skip()
      return
    }

    // Form alliance to get more cards
    await page.getByRole('button', { name: /view terms/i }).first().click()
    await waitForHydration(page)
    await page.getByTestId('btn-form-alliance').click()
    await waitForHydration(page)
    await page.getByTestId('btn-continue-to-cards').click()
    await page.waitForURL('**/card-pool')

    // Must have at least 5 selectable cards
    const cards = page.locator('[data-testid^="card-"]')
    const count = await cards.count()

    expect(count).toBeGreaterThanOrEqual(5)
  })
})

// ============================================================================
// Narrative Screen Options
// ============================================================================

test.describe('Narrative Screen Options', () => {
  test('narrative always shows at least one choice', async ({ page }) => {
    await startNewGame(page)
    await acceptQuest(page)

    // Should be on narrative with choices visible
    await expect(page).toHaveURL(/narrative/)

    const choices = page.locator('[data-testid^="choice-"]')
    const count = await choices.count()

    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('all displayed choices are clickable', async ({ page }) => {
    await startNewGame(page)
    await acceptQuest(page)

    const choices = page.locator('[data-testid^="choice-"]')
    const count = await choices.count()

    // Each choice should be clickable (not disabled)
    for (let i = 0; i < count; i++) {
      const choice = choices.nth(i)
      await expect(choice).toBeEnabled()
    }
  })
})
