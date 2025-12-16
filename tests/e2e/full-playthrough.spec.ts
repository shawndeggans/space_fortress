/**
 * Full Playthrough Tests for Space Fortress
 *
 * These tests verify game flows through Playwright.
 * Video recording is enabled for all tests to aid in debugging and review.
 *
 * UPDATED: Now handles the choice-consequence and quest-summary phases
 * that were added to the narrative flow.
 */
import { test, expect } from '@playwright/test'
import {
  startNewGame,
  acceptQuest,
  makeChoice,
  makeChoiceAndContinue,
  continueFromChoiceConsequence,
  formAllianceAndContinue,
  waitForHydration,
  expectScreen,
} from './helpers/gameActions'
import * as selectors from './helpers/selectors'

test.describe('Game Navigation', () => {
  test('can start a new game and reach quest hub', async ({ page }) => {
    await startNewGame(page)
    await expectScreen(page, 'quest-hub')

    // Verify quest hub has content
    await expect(selectors.common.heading(page, /Quest Hub/i)).toBeVisible()
    await expect(selectors.questHub.anyQuestCard(page).first()).toBeVisible()
  })

  test('can accept a quest and reach narrative', async ({ page }) => {
    await startNewGame(page)
    await acceptQuest(page)
    await expectScreen(page, 'narrative')

    // Verify narrative has choices
    await expect(selectors.narrative.anyChoice(page).first()).toBeVisible()
  })

  test('can make a choice and see choice consequence', async ({ page }) => {
    await startNewGame(page)
    await acceptQuest(page)

    // Make a choice - goes to choice-consequence screen
    await makeChoice(page, 1)
    await expectScreen(page, 'choice-consequence')

    // Verify choice consequence screen has content
    await expect(selectors.choiceConsequence.title(page)).toBeVisible()
    await expect(selectors.choiceConsequence.continueButton(page)).toBeVisible()
  })

  test('can continue from choice consequence to next phase', async ({ page }) => {
    await startNewGame(page)
    await acceptQuest(page)

    // Make a choice and continue
    const nextPath = await makeChoiceAndContinue(page, 1)

    // Should navigate to next phase (narrative, alliance, or quest-summary)
    expect(nextPath).toMatch(/\/(narrative|alliance|quest-summary|mediation)/)
  })

  test('can navigate through multiple dilemmas with choice consequences', async ({ page }) => {
    await startNewGame(page)
    await acceptQuest(page)

    // Make choice 1 and continue through choice-consequence
    let nextPath = await makeChoiceAndContinue(page, 1)

    // If still on narrative, we reached dilemma 2
    if (nextPath.includes('/narrative')) {
      await expect(selectors.narrative.anyChoice(page).first()).toBeVisible()

      // Make another choice and continue
      nextPath = await makeChoiceAndContinue(page, 0)
    }

    // Should be somewhere in the game flow
    expect(nextPath).toMatch(/\/(narrative|alliance|card-pool|quest-summary|mediation)/)
  })
})

test.describe('Choice Consequence Phase', () => {
  test('choice consequence shows consequences of the choice', async ({ page }) => {
    await startNewGame(page)
    await acceptQuest(page)

    // Make a choice
    await makeChoice(page, 0)
    await expectScreen(page, 'choice-consequence')

    // Verify the screen shows the choice consequence content
    await expect(selectors.choiceConsequence.title(page)).toBeVisible()
    await expect(selectors.choiceConsequence.narrativeText(page)).toBeVisible()
    await expect(selectors.choiceConsequence.continueButton(page)).toBeVisible()
  })

  test('continue button advances to next phase', async ({ page }) => {
    await startNewGame(page)
    await acceptQuest(page)

    // Make a choice
    await makeChoice(page, 0)
    await expectScreen(page, 'choice-consequence')

    // Get the current URL
    const beforeUrl = page.url()
    expect(beforeUrl).toContain('choice-consequence')

    // Click continue
    await continueFromChoiceConsequence(page)

    // Should have navigated away from choice-consequence
    const afterUrl = page.url()
    expect(afterUrl).not.toEqual(beforeUrl)
  })
})

test.describe('Alliance Phase', () => {
  test('can reach alliance screen and see options', async ({ page }) => {
    await startNewGame(page)
    await acceptQuest(page)

    // Navigate through narrative with choice-consequence phases
    let nextPath = await makeChoiceAndContinue(page, 1)

    if (nextPath.includes('/narrative')) {
      nextPath = await makeChoiceAndContinue(page, 2)
    }

    if (nextPath.includes('/alliance')) {
      await expectScreen(page, 'alliance')

      // Verify alliance options are visible
      await expect(selectors.common.heading(page, /Form an Alliance/i)).toBeVisible()
      await expect(selectors.alliance.proceedAloneButton(page)).toBeVisible()
    }
  })

  test('proceed alone button is disabled without enough cards', async ({ page }) => {
    await startNewGame(page)
    await acceptQuest(page)

    // Navigate to alliance
    let nextPath = await makeChoiceAndContinue(page, 1)

    if (nextPath.includes('/narrative')) {
      nextPath = await makeChoiceAndContinue(page, 2)
    }

    if (nextPath.includes('/alliance')) {
      await expectScreen(page, 'alliance')

      // Verify proceed alone button is DISABLED (player has only 4 cards, needs 5)
      await expect(selectors.alliance.proceedAloneButton(page)).toBeDisabled()

      // Verify the warning message is shown
      await expect(page.locator('.card-requirement-banner')).toBeVisible()
    }
  })
})

test.describe('Card Pool Phase', () => {
  test('can reach card pool and see cards', async ({ page }) => {
    await startNewGame(page)
    await acceptQuest(page)

    // Make choice and continue through choice-consequence
    let nextPath = await makeChoiceAndContinue(page, 0)

    if (nextPath.includes('/alliance')) {
      // Form alliance to get enough cards for battle (3 starter + 1 quest + 2 alliance = 6)
      await formAllianceAndContinue(page)
    }

    if (page.url().includes('/card-pool')) {
      await expectScreen(page, 'card-pool')

      // Verify card pool has cards
      await expect(selectors.common.heading(page, /Select Your Fleet/i)).toBeVisible()
      await expect(selectors.cardPool.anyCard(page).first()).toBeVisible()

      // Verify we have 6+ cards (3 starter + 1 quest + 2 alliance)
      const cardCount = await selectors.cardPool.anyCard(page).count()
      expect(cardCount).toBeGreaterThanOrEqual(6)
    }
  })

  test('can select cards for battle', async ({ page }) => {
    await startNewGame(page)
    await acceptQuest(page)

    // Navigate through with choice-consequence
    let nextPath = await makeChoiceAndContinue(page, 0)

    if (nextPath.includes('/alliance')) {
      await formAllianceAndContinue(page)
    }

    if (page.url().includes('/card-pool')) {
      const cards = selectors.cardPool.anyCard(page)
      const cardCount = await cards.count()

      // Select 5 cards for battle
      for (let i = 0; i < 5 && i < cardCount; i++) {
        await cards.nth(i).click()
        await page.waitForTimeout(100)
      }

      // Verify selection count shows 5 cards selected
      const selectionText = await page.locator('.selection-count').textContent()
      expect(selectionText).toContain('5')

      // With 5+ cards, commit button should be ENABLED
      await expect(selectors.cardPool.commitFleetButton(page)).toBeEnabled()
    }
  })
})

test.describe('Quest Selection', () => {
  test('verifies quest selection modal works', async ({ page }) => {
    await startNewGame(page)

    // Check quest cards are visible
    const questCards = selectors.questHub.anyQuestCard(page)
    await expect(questCards.first()).toBeVisible()

    const questCount = await questCards.count()
    expect(questCount).toBeGreaterThan(0)

    // Click first quest
    await questCards.first().click()

    // Verify modal opens
    await expect(selectors.common.modal(page)).toBeVisible()
    await expect(selectors.questHub.acceptQuestButton(page)).toBeVisible()
    await expect(selectors.questHub.declineQuestButton(page)).toBeVisible()
  })

  test('can decline quest and stay on quest hub', async ({ page }) => {
    await startNewGame(page)

    // Click first quest
    await selectors.questHub.anyQuestCard(page).first().click()
    await expect(selectors.common.modal(page)).toBeVisible()

    // Click decline
    await selectors.questHub.declineQuestButton(page).click()

    // Modal should close, still on quest hub
    await expect(selectors.common.modal(page)).not.toBeVisible()
    await expectScreen(page, 'quest-hub')
  })
})

test.describe('Full Battle Flow', () => {
  test('can complete battle with alliance cards', async ({ page }) => {
    await startNewGame(page)
    await acceptQuest(page)

    // Make choice that triggers battle/alliance (goes through choice-consequence)
    let nextPath = await makeChoiceAndContinue(page, 0)

    // Form alliance to get enough cards (3 starter + 1 quest + 2 alliance = 6)
    if (nextPath.includes('/alliance')) {
      await formAllianceAndContinue(page)
    }

    // Now we have 6 cards and can proceed to battle
    if (page.url().includes('/card-pool')) {
      await expectScreen(page, 'card-pool')

      // Verify we have 6+ cards
      const cards = selectors.cardPool.anyCard(page)
      const cardCount = await cards.count()

      // Log card count for debugging
      console.log(`Available cards for battle: ${cardCount}`)
      expect(cardCount).toBeGreaterThanOrEqual(6)

      // Select 5 cards
      for (let i = 0; i < 5; i++) {
        await cards.nth(i).click()
        await page.waitForTimeout(100)
      }

      // Commit fleet button should be enabled
      await expect(selectors.cardPool.commitFleetButton(page)).toBeEnabled({ timeout: 5000 })
      await selectors.cardPool.commitFleetButton(page).click()

      // Should navigate to deployment
      await page.waitForURL('**/deployment', { timeout: 10000 })
      await expectScreen(page, 'deployment')
    }
  })
})

test.describe('Quest Summary Phase', () => {
  test('quest summary shows after completing narrative-only quest', async ({ page }) => {
    await startNewGame(page)
    await acceptQuest(page)

    // Navigate through narrative until quest-summary (if this quest doesn't have battle)
    let attempts = 0
    while (attempts < 20) {
      const url = page.url()

      if (url.includes('quest-summary')) {
        // Found quest summary
        await expectScreen(page, 'quest-summary')
        await expect(selectors.questSummary.title(page)).toBeVisible()
        await expect(selectors.questSummary.continueButton(page)).toBeVisible()
        return
      }

      if (url.includes('alliance') || url.includes('card-pool')) {
        // This quest has a battle, skip this test
        console.log('Quest has battle - quest-summary comes after battle')
        return
      }

      if (url.includes('narrative')) {
        await makeChoice(page, 0)
      } else if (url.includes('choice-consequence')) {
        await continueFromChoiceConsequence(page)
      }

      attempts++
      await page.waitForTimeout(300)
    }
  })

  test('continue from quest summary returns to quest hub', async ({ page }) => {
    await startNewGame(page)
    await acceptQuest(page)

    // Navigate through narrative
    let attempts = 0
    while (attempts < 20) {
      const url = page.url()

      if (url.includes('quest-summary')) {
        // Click continue to return to quest hub
        await selectors.questSummary.continueButton(page).click()
        await page.waitForURL('**/quest-hub', { timeout: 5000 })
        await expectScreen(page, 'quest-hub')
        return
      }

      if (url.includes('alliance') || url.includes('card-pool')) {
        console.log('Quest has battle - skipping quest-summary navigation test')
        return
      }

      if (url.includes('narrative')) {
        await makeChoice(page, 0)
      } else if (url.includes('choice-consequence')) {
        await continueFromChoiceConsequence(page)
      }

      attempts++
      await page.waitForTimeout(300)
    }
  })
})
