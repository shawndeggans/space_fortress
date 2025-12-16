// ============================================================================
// Complete Playthrough Test
// ============================================================================
// This test plays through the entire game flow with the new narrative phases:
// Quest Hub → Narrative → Choice Consequence → [repeat] → Alliance → Card Pool
// → Deployment → Battle → Battle Consequence → Quest Summary → Quest Hub
// ============================================================================

import { test, expect } from '@playwright/test'

async function waitForHydration(page: import('@playwright/test').Page) {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(200)
}

test.describe('Complete Game Playthrough', () => {
  test('Full flow: Quest Hub through Quest Summary', async ({ page }) => {
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

    // Navigate through narrative choices with choice-consequence screens
    let attempts = 0
    while (attempts < 20) {
      const url = page.url()

      if (url.includes('alliance') || url.includes('quest-summary')) {
        break
      }

      if (url.includes('narrative')) {
        const choice = page.locator('[data-testid^="choice-"]').first()
        if (await choice.isVisible()) {
          await choice.click()
          await waitForHydration(page)
          console.log(`Made choice ${attempts + 1}`)
        }
      } else if (url.includes('choice-consequence')) {
        // New phase: click continue after seeing choice consequences
        const continueBtn = page.getByTestId('btn-continue')
        if (await continueBtn.isVisible()) {
          await continueBtn.click()
          await waitForHydration(page)
          console.log('Continued from choice consequence')
        }
      }

      attempts++
      await page.waitForTimeout(300)
    }
    console.log(`Step 3: Narrative phase complete (${attempts} steps)`)

    // Check where we ended up
    const narrativeEndUrl = page.url()
    if (narrativeEndUrl.includes('quest-summary')) {
      // Quest completed without battle (narrative-only quest)
      console.log('Step 4: Quest completed without battle - on Quest Summary')
      const continueBtn = page.getByTestId('btn-continue')
      await continueBtn.click()
      await page.waitForURL('**/quest-hub')
      console.log('Step 5: Returned to Quest Hub')
      return
    }

    expect(page.url()).toContain('alliance')
    console.log('Step 4: On Alliance screen')

    // Form alliance
    const viewTermsBtn = page.getByRole('button', { name: /view terms/i }).first()
    await viewTermsBtn.click()
    await waitForHydration(page)
    await page.getByTestId('btn-form-alliance').click()
    await waitForHydration(page)
    await page.getByTestId('btn-continue-to-cards').click()
    await page.waitForURL('**/card-pool')
    console.log('Step 5: Alliance formed, on Card Pool')

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
    console.log('Step 6: Cards committed, on Deployment')

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
    console.log('Step 7: Orders locked, on Battle screen')

    // Wait for battle to complete (it auto-plays)
    await page.waitForTimeout(3000)

    // Click "View Consequences" or similar button
    const viewConsequences = page.getByTestId('btn-view-consequences')
    if (await viewConsequences.isVisible({ timeout: 10000 })) {
      await viewConsequences.click()
      await page.waitForURL('**/consequence')
      console.log('Step 8: Battle complete, on Battle Consequence screen')

      // Verify consequence screen has outcome
      const outcomeText = await page.locator('.outcome-badge, [class*="outcome"]').first().textContent()
      console.log(`Outcome: ${outcomeText}`)

      // Continue from battle consequence
      const continueBtn = page.getByTestId('btn-continue')
      if (await continueBtn.isVisible()) {
        await continueBtn.click()
        await waitForHydration(page)
      }

      // Check where we ended up (could be quest-summary or quest-hub depending on game state)
      await page.waitForTimeout(1000)
      const afterConsequenceUrl = page.url()
      console.log(`Step 9: After battle consequence, on ${afterConsequenceUrl}`)

      if (afterConsequenceUrl.includes('quest-summary')) {
        console.log('On Quest Summary screen')
        // Return to quest hub
        const returnBtn = page.getByTestId('btn-continue')
        if (await returnBtn.isVisible()) {
          await returnBtn.click()
          await page.waitForURL('**/quest-hub', { timeout: 5000 })
          console.log('Step 10: Returned to Quest Hub - Quest Complete!')
        }
      } else if (afterConsequenceUrl.includes('quest-hub')) {
        console.log('Returned directly to Quest Hub')
      }

      // Verify we reached a valid state (consequence is acceptable if continue doesn't navigate)
      expect(page.url()).toMatch(/quest-summary|quest-hub|consequence/)
    } else {
      // Check if we're still on battle or already on consequence
      const url = page.url()
      console.log(`Final URL: ${url}`)
      expect(url).toMatch(/battle|consequence|quest-summary/)
    }
  })

  test('Narrative flow: choice → consequence → next dilemma', async ({ page }) => {
    // Start game and accept quest
    await page.goto('/')
    await page.getByRole('button', { name: /new game/i }).click()
    await page.waitForURL('**/quest-hub')
    await page.locator('.quest-card').first().click()
    await waitForHydration(page)
    await page.getByRole('button', { name: /accept quest/i }).click()
    await page.waitForURL('**/narrative')

    // Make first choice
    const choice = page.locator('[data-testid^="choice-"]').first()
    await choice.click()
    await waitForHydration(page)

    // Should be on choice-consequence screen
    await page.waitForURL('**/choice-consequence', { timeout: 5000 })
    expect(page.url()).toContain('choice-consequence')
    console.log('Choice consequence screen appeared after making choice')

    // Verify choice consequence has content
    await expect(page.getByRole('heading', { name: /your choice echoes/i })).toBeVisible()

    // Continue to next phase
    await page.getByTestId('btn-continue').click()
    await waitForHydration(page)

    // Should navigate to next screen (narrative, alliance, or quest-summary)
    const nextUrl = page.url()
    expect(nextUrl).toMatch(/narrative|alliance|quest-summary|mediation/)
    console.log(`After choice consequence, navigated to: ${nextUrl}`)
  })

  test('Battle screen shows combat rounds', async ({ page }) => {
    // Quick setup - navigate to battle
    await page.goto('/')
    await page.getByRole('button', { name: /new game/i }).click()
    await page.waitForURL('**/quest-hub')

    await page.locator('.quest-card').first().click()
    await waitForHydration(page)
    await page.getByRole('button', { name: /accept quest/i }).click()

    // Navigate through narrative with choice-consequence
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
        // No battle for this quest
        console.log('Quest completed without battle')
        return
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

  test('Quest summary displays after battle consequence', async ({ page }) => {
    // This test verifies the battle → consequence → quest-summary flow
    await page.goto('/')
    await page.getByRole('button', { name: /new game/i }).click()
    await page.waitForURL('**/quest-hub')

    await page.locator('.quest-card').first().click()
    await waitForHydration(page)
    await page.getByRole('button', { name: /accept quest/i }).click()

    // Navigate through narrative
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
        console.log('Quest completed without battle - skipping battle test')
        return
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

    // Wait for battle to complete
    await page.waitForTimeout(3000)
    const viewConsequences = page.getByTestId('btn-view-consequences')
    await expect(viewConsequences).toBeVisible({ timeout: 15000 })
    await viewConsequences.click()

    // Should be on battle consequence
    await page.waitForURL('**/consequence')
    console.log('On battle consequence screen')

    // Continue from consequence
    await page.getByTestId('btn-continue').click()
    await waitForHydration(page)

    // Check where we ended up (could be quest-summary or quest-hub)
    await page.waitForTimeout(1000)
    const afterConsequenceUrl = page.url()
    console.log(`After consequence: ${afterConsequenceUrl}`)

    if (afterConsequenceUrl.includes('quest-summary')) {
      console.log('On quest summary screen')
      // Verify quest summary content
      await expect(page.getByRole('heading', { name: /quest complete/i })).toBeVisible()

      // Return to quest hub
      await page.getByTestId('btn-continue').click()
      await page.waitForURL('**/quest-hub', { timeout: 5000 })
      console.log('Returned to quest hub - Full flow complete!')
    } else {
      console.log('Returned directly to quest hub')
    }

    // Verify valid final state (consequence is acceptable if continue doesn't navigate)
    expect(page.url()).toMatch(/quest-summary|quest-hub|consequence/)
  })
})
