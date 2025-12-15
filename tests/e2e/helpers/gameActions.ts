/**
 * Game action helpers for Space Fortress E2E tests.
 * These functions encapsulate common game interactions with proper waits.
 */
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import * as selectors from './selectors'

/**
 * Wait for Svelte hydration to complete
 */
export async function waitForHydration(page: Page, timeout = 5000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout })
  // Give Svelte a moment to hydrate
  await page.waitForTimeout(300)
}

/**
 * Start a new game from the main menu
 */
export async function startNewGame(page: Page): Promise<void> {
  await page.goto('/')
  await waitForHydration(page)

  await selectors.menu.newGameButton(page).click()

  // Wait for navigation to quest hub
  await page.waitForURL('**/quest-hub', { timeout: 10000 })
  await waitForHydration(page)
}

/**
 * Accept a quest (first available if no questId specified)
 */
export async function acceptQuest(page: Page, questId?: string): Promise<void> {
  await waitForHydration(page)

  // Click on a quest card to open the modal
  if (questId) {
    await selectors.questHub.questCard(page, questId).click()
  } else {
    await selectors.questHub.anyQuestCard(page).first().click()
  }

  // Wait for modal to appear
  await expect(selectors.common.modal(page)).toBeVisible({ timeout: 5000 })

  // Click Accept Quest button
  await selectors.questHub.acceptQuestButton(page).click()

  // Wait for navigation to narrative
  await page.waitForURL('**/narrative', { timeout: 10000 })
  await waitForHydration(page)
}

/**
 * Make a choice on the narrative screen
 */
export async function makeChoice(page: Page, choiceIndex = 0): Promise<void> {
  await waitForHydration(page)

  // Wait for choices to be available
  await expect(selectors.narrative.anyChoice(page).first()).toBeVisible({ timeout: 5000 })

  // Click the choice
  await selectors.narrative.nthChoice(page, choiceIndex).click()

  // Wait for navigation (could go to alliance, card-pool, or stay on narrative)
  await page.waitForTimeout(500)
  await waitForHydration(page)
}

/**
 * Form an alliance with a faction.
 * Note: This does NOT navigate away - player can form multiple alliances.
 * Call finalizeAllianceAndContinue() to proceed to card pool.
 */
export async function formAlliance(page: Page, factionId?: string): Promise<void> {
  await waitForHydration(page)

  if (factionId) {
    // Click on specific faction
    const option = selectors.alliance.allianceOption(page, factionId)
    await option.getByRole('button', { name: 'View Terms' }).click()
  } else {
    // Try to form alliance with first available faction
    const firstOption = selectors.alliance.anyAllianceOption(page).first()
    await firstOption.getByRole('button', { name: 'View Terms' }).click()
  }

  await expect(selectors.common.modal(page)).toBeVisible({ timeout: 5000 })
  await selectors.alliance.formAllianceButton(page).click()

  // Wait for modal to close (alliance formed, stay on alliance page)
  await expect(selectors.common.modal(page)).not.toBeVisible({ timeout: 5000 })
  await waitForHydration(page)
}

/**
 * After forming alliance(s), click continue to proceed to card pool.
 */
export async function finalizeAllianceAndContinue(page: Page): Promise<void> {
  await waitForHydration(page)

  // Click the continue button
  await selectors.alliance.continueToCardsButton(page).click()

  // Wait for navigation to card pool
  await page.waitForURL('**/card-pool', { timeout: 10000 })
  await waitForHydration(page)
}

/**
 * Form an alliance and immediately continue to card pool.
 * Convenience function for tests that just need to get past alliance phase.
 */
export async function formAllianceAndContinue(page: Page, factionId?: string): Promise<void> {
  await formAlliance(page, factionId)
  await finalizeAllianceAndContinue(page)
}

/**
 * Skip alliance and proceed alone.
 * Note: This only works if player has 5+ cards. With default starter cards (3)
 * plus quest card (1) = 4 cards, this button will be DISABLED.
 * Most tests should use formAllianceAndContinue() instead.
 */
export async function proceedWithoutAlliance(page: Page): Promise<void> {
  await waitForHydration(page)

  const button = selectors.alliance.proceedAloneButton(page)
  const isDisabled = await button.isDisabled()

  if (isDisabled) {
    throw new Error(
      'Cannot proceed without alliance: button is disabled. ' +
      'Player needs 5+ cards for battle but likely only has 4 (3 starter + 1 quest). ' +
      'Use formAllianceAndContinue() to form an alliance and gain more cards.'
    )
  }

  await button.click()

  // Wait for navigation to card pool
  await page.waitForURL('**/card-pool', { timeout: 10000 })
  await waitForHydration(page)
}

/**
 * Select cards for battle (all available cards, up to count)
 * Note: Player needs 5 cards for battle. If only 3 starter cards exist,
 * they must form an alliance to get additional cards.
 */
export async function selectCardsForBattle(page: Page, count = 5): Promise<void> {
  await waitForHydration(page)

  // Get all available cards (some may already be selected)
  const cards = selectors.cardPool.anyCard(page)
  const cardCount = await cards.count()

  // Click on each card to select it (clicking selected cards will deselect, so we need to be careful)
  // First, let's click on cards that aren't already selected
  for (let i = 0; i < cardCount && i < count; i++) {
    const card = cards.nth(i)
    // Check if card is already selected (has checkmark or selected state)
    const isSelected = await card.locator('.card__selection-indicator').count() > 0
    if (!isSelected) {
      await card.click()
      await page.waitForTimeout(150) // Brief pause between selections
    }
  }

  // Check if we have enough cards selected
  const commitButton = selectors.cardPool.commitFleetButton(page)

  // If button is still disabled, we might not have enough cards
  // This can happen if player only has 3 starter cards and didn't form alliance
  const isEnabled = await commitButton.isEnabled().catch(() => false)
  if (!isEnabled) {
    // Log warning and check the current state
    const selectionText = await page.locator('.selection-count').textContent()
    console.log(`Card selection warning: ${selectionText}. Only ${cardCount} cards available.`)

    // If we can't proceed, throw a descriptive error
    throw new Error(
      `Cannot commit fleet: need 5 cards but only ${cardCount} available. ` +
        `Consider forming an alliance to gain additional cards.`
    )
  }

  await commitButton.click()

  // Wait for navigation to deployment
  await page.waitForURL('**/deployment', { timeout: 10000 })
  await waitForHydration(page)
}

/**
 * Deploy cards to battle positions
 */
export async function deployCards(page: Page): Promise<void> {
  await waitForHydration(page)

  // Get unassigned cards and click them to auto-assign to slots
  const unassignedCards = selectors.deployment.unassignedCards(page)

  while (await unassignedCards.count() > 0) {
    await unassignedCards.first().click()
    await page.waitForTimeout(100)
  }

  // Wait for lock orders button to be enabled and click
  await expect(selectors.deployment.lockOrdersButton(page)).toBeEnabled({ timeout: 5000 })
  await selectors.deployment.lockOrdersButton(page).click()

  // Wait for navigation to battle
  await page.waitForURL('**/battle', { timeout: 10000 })
  await waitForHydration(page)
}

/**
 * Complete the battle phase (battle auto-resolves, just wait for result)
 */
export async function completeBattle(page: Page): Promise<void> {
  await waitForHydration(page)

  // Wait for battle to complete and View Consequences button to appear
  await expect(selectors.battle.viewConsequencesButton(page)).toBeVisible({ timeout: 30000 })
  await selectors.battle.viewConsequencesButton(page).click()

  // Wait for navigation to consequence
  await page.waitForURL('**/consequence', { timeout: 10000 })
  await waitForHydration(page)
}

/**
 * Continue from consequence screen
 */
export async function continueFromConsequence(page: Page): Promise<string> {
  await waitForHydration(page)

  await selectors.consequence.continueButton(page).click()

  // Wait for navigation (could go to narrative, quest-hub, or ending)
  await page.waitForTimeout(500)
  await waitForHydration(page)

  // Return the new URL path
  return new URL(page.url()).pathname
}

/**
 * Play through a complete quest (narrative -> alliance -> battle -> consequence)
 */
export async function playFullQuest(
  page: Page,
  options?: {
    allyWithFaction?: string | false  // false = go alone (only works if 5+ cards)
    choiceIndices?: number[]          // which choices to make at each dilemma
  }
): Promise<void> {
  const choiceIndices = options?.choiceIndices || [0]

  // Keep making choices until we leave narrative phase
  let choiceCount = 0
  while (page.url().includes('/narrative')) {
    const index = choiceIndices[choiceCount] ?? 0
    await makeChoice(page, index)
    choiceCount++

    // Check where we ended up
    await page.waitForTimeout(300)
  }

  // If we're at alliance screen
  if (page.url().includes('/alliance')) {
    if (options?.allyWithFaction === false) {
      // Go alone - will throw if player doesn't have 5+ cards
      await proceedWithoutAlliance(page)
    } else {
      // Form alliance (required to get enough cards for battle)
      await formAllianceAndContinue(page, options?.allyWithFaction || undefined)
    }
  }

  // If we're at card pool
  if (page.url().includes('/card-pool')) {
    await selectCardsForBattle(page, 5)
  }

  // If we're at deployment
  if (page.url().includes('/deployment')) {
    await deployCards(page)
  }

  // If we're at battle
  if (page.url().includes('/battle')) {
    await completeBattle(page)
  }

  // If we're at consequence
  if (page.url().includes('/consequence')) {
    await continueFromConsequence(page)
  }
}

/**
 * Play a complete game (3 quests to ending)
 */
export async function playFullGame(
  page: Page,
  options?: {
    allianceStrategy?: 'always' | 'never' | 'first-only'
    maxQuests?: number
  }
): Promise<{
  questsCompleted: number
  endingReached: boolean
}> {
  const maxQuests = options?.maxQuests ?? 3
  let questsCompleted = 0

  // Start the game
  await startNewGame(page)

  while (questsCompleted < maxQuests) {
    // Accept first available quest
    if (page.url().includes('/quest-hub')) {
      await acceptQuest(page)
    }

    // Determine alliance strategy for this quest
    let allyStrategy: string | false | undefined
    switch (options?.allianceStrategy) {
      case 'never':
        allyStrategy = false
        break
      case 'first-only':
        allyStrategy = questsCompleted === 0 ? undefined : false
        break
      default:
        allyStrategy = undefined // will try to ally
    }

    // Play through the quest
    await playFullQuest(page, { allyWithFaction: allyStrategy })
    questsCompleted++

    // Check if we reached ending
    if (page.url().includes('/ending')) {
      return { questsCompleted, endingReached: true }
    }

    // Otherwise we should be at quest hub for next quest
    if (!page.url().includes('/quest-hub')) {
      // Navigate back if needed
      await page.goto('/quest-hub')
      await waitForHydration(page)
    }
  }

  return { questsCompleted, endingReached: page.url().includes('/ending') }
}

/**
 * Get the current game phase from the URL
 */
export function getCurrentPhase(page: Page): string {
  const path = new URL(page.url()).pathname
  const phase = path.split('/').pop() || 'home'
  return phase
}

/**
 * Verify we're on the expected screen
 */
export async function expectScreen(page: Page, screen: string): Promise<void> {
  const validScreens = ['quest-hub', 'narrative', 'alliance', 'card-pool', 'deployment', 'battle', 'consequence', 'ending']
  if (!validScreens.includes(screen)) {
    throw new Error(`Invalid screen: ${screen}. Valid screens are: ${validScreens.join(', ')}`)
  }
  await expect(page).toHaveURL(new RegExp(`/${screen}`))
}

/**
 * Check if an error toast is visible
 */
export async function hasError(page: Page): Promise<boolean> {
  return await page.getByTestId('error-toast').isVisible().catch(() => false)
}

/**
 * Get the current error message (if any)
 */
export async function getErrorMessage(page: Page): Promise<string | null> {
  const errorEl = page.getByTestId('error-message')
  if (await errorEl.isVisible().catch(() => false)) {
    return await errorEl.textContent()
  }
  return null
}

/**
 * Wait for an error to appear and return its message
 */
export async function waitForError(page: Page, timeout = 5000): Promise<string> {
  const errorToast = page.getByTestId('error-toast')
  await expect(errorToast).toBeVisible({ timeout })
  const message = await page.getByTestId('error-message').textContent()
  return message || ''
}

/**
 * Dismiss the error toast if visible
 */
export async function dismissError(page: Page): Promise<void> {
  const dismissBtn = page.getByTestId('btn-dismiss-error')
  if (await dismissBtn.isVisible().catch(() => false)) {
    await dismissBtn.click()
    await expect(page.getByTestId('error-toast')).not.toBeVisible()
  }
}

/**
 * Get the last game error from window (debug mode only)
 */
export async function getLastGameError(page: Page): Promise<any> {
  return await page.evaluate(() => (window as any).__lastGameError)
}

/**
 * Get debug error history from window (debug mode only)
 */
export async function getErrorHistory(page: Page): Promise<any[]> {
  return await page.evaluate(() => {
    const sf = (window as any).__spacefortress
    return sf ? sf.getErrorHistory() : []
  })
}
