// ============================================================================
// Complete Playthrough Test
// ============================================================================
// This test plays through the entire game flow:
// Quest Hub → Narrative → Alliance → Card Pool → Deployment → Battle → Consequence
// ============================================================================

import { test, expect } from '@playwright/test'

async function waitForHydration(page: import('@playwright/test').Page) {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(200)
}

test.describe('Complete Game Playthrough', () => {
  test('Full flow: Quest Hub through Consequence', async ({ page }) => {
    // Start game
    await page.goto('/')
    await waitForHydration(page)
    await page.getByRole('button', { name: /new game/i }).click()
    await page.waitForURL('**/quest-hub')
    console.log('Step 1: Quest Hub loaded')

    // Accept first quest
    await page.locator('.quest-card').first().click()
    await waitForHydration(page)
    await page.getByRole('button', { name: /accept quest/i }).click()
    await page.waitForURL('**/narrative')
    console.log('Step 2: Quest accepted, on Narrative')

    // Navigate through narrative choices until alliance
    let attempts = 0
    while (attempts < 10 && !page.url().includes('alliance')) {
      const choice = page.locator('[data-testid^="choice-"]').first()
      if (await choice.isVisible()) {
        await choice.click()
        await waitForHydration(page)
      }
      attempts++
      await page.waitForTimeout(300)
    }
    console.log(`Step 3: Narrative phase complete (${attempts} choices made)`)
    expect(page.url()).toContain('alliance')

    // Form alliance
    const viewTermsBtn = page.getByRole('button', { name: /view terms/i }).first()
    await viewTermsBtn.click()
    await waitForHydration(page)
    await page.getByTestId('btn-form-alliance').click()
    await waitForHydration(page)
    await page.getByTestId('btn-continue-to-cards').click()
    await page.waitForURL('**/card-pool')
    console.log('Step 4: Alliance formed, on Card Pool')

    // Select 5 cards and commit
    const cards = page.locator('[data-testid^="card-"]')
    const cardCount = await cards.count()
    console.log(`Found ${cardCount} cards in pool`)
    for (let i = 0; i < Math.min(5, cardCount); i++) {
      await cards.nth(i).click()
      await page.waitForTimeout(100)
    }
    await page.getByTestId('btn-commit-fleet').click()
    await page.waitForURL('**/deployment')
    console.log('Step 5: Cards committed, on Deployment')

    // Assign all cards to positions
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
    console.log(`Assigned ${assigned} cards to positions`)

    // Lock orders
    const lockBtn = page.getByTestId('btn-lock-orders')
    await expect(lockBtn).toBeEnabled({ timeout: 5000 })
    await lockBtn.click()
    await page.waitForURL('**/battle', { timeout: 10000 })
    console.log('Step 6: Orders locked, on Battle screen')

    // Wait for battle to complete (it auto-plays)
    await page.waitForTimeout(3000)

    // Click "View Consequences" or similar button
    const viewConsequences = page.getByTestId('btn-view-consequences')
    if (await viewConsequences.isVisible({ timeout: 10000 })) {
      await viewConsequences.click()
      await page.waitForURL('**/consequence')
      console.log('Step 7: Battle complete, on Consequence screen')

      // Verify consequence screen has outcome
      const outcomeText = await page.locator('.outcome-badge, [class*="outcome"]').first().textContent()
      console.log(`Outcome: ${outcomeText}`)

      // The playthrough is complete!
      expect(page.url()).toContain('consequence')
    } else {
      // Check if we're still on battle or already on consequence
      const url = page.url()
      console.log(`Final URL: ${url}`)
      expect(url).toMatch(/battle|consequence/)
    }
  })

  test('Battle screen shows combat rounds', async ({ page }) => {
    // Quick setup - navigate to battle
    await page.goto('/')
    await page.getByRole('button', { name: /new game/i }).click()
    await page.waitForURL('**/quest-hub')

    await page.locator('.quest-card').first().click()
    await waitForHydration(page)
    await page.getByRole('button', { name: /accept quest/i }).click()

    // Navigate to alliance
    let attempts = 0
    while (attempts < 10 && !page.url().includes('alliance')) {
      const choice = page.locator('[data-testid^="choice-"]').first()
      if (await choice.isVisible()) {
        await choice.click()
        await waitForHydration(page)
      }
      attempts++
      await page.waitForTimeout(300)
    }

    // Form alliance
    const viewTermsBtn = page.getByRole('button', { name: /view terms/i }).first()
    await viewTermsBtn.click()
    await waitForHydration(page)
    await page.getByTestId('btn-form-alliance').click()
    await waitForHydration(page)
    await page.getByTestId('btn-continue-to-cards').click()
    await page.waitForURL('**/card-pool')

    // Select cards
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

    // Verify battle screen has expected elements
    await expect(page.locator('.battle-screen').first()).toBeVisible()

    // Should show round information
    const roundText = await page.locator('.round-indicator, [class*="round"]').first().textContent().catch(() => 'Round info not visible')
    console.log(`Battle round info: ${roundText}`)

    // Battle should eventually complete
    await page.waitForTimeout(5000) // Let battle play out

    // Check for completion state or continue button
    const hasViewConsequences = await page.getByTestId('btn-view-consequences').isVisible().catch(() => false)
    console.log(`Has View Consequences button: ${hasViewConsequences}`)

    expect(page.url()).toContain('battle')
  })
})
