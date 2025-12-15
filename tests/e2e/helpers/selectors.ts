/**
 * Centralized test selectors for Space Fortress E2E tests.
 * Uses data-testid attributes for reliable element selection.
 */
import type { Page, Locator } from '@playwright/test'

/**
 * Main menu / home page selectors
 */
export const menu = {
  newGameButton: (page: Page) => page.getByTestId('btn-new-game'),
  continueButton: (page: Page) => page.getByTestId('btn-continue'),
  loadGameButton: (page: Page) => page.getByTestId('btn-load-game'),
}

/**
 * Quest hub selectors
 */
export const questHub = {
  questCard: (page: Page, questId: string) => page.getByTestId(`quest-${questId}`),
  anyQuestCard: (page: Page) => page.locator('[data-testid^="quest-"]'),
  acceptQuestButton: (page: Page) => page.getByTestId('btn-accept-quest'),
  declineQuestButton: (page: Page) => page.getByTestId('btn-decline-quest'),
}

/**
 * Narrative screen selectors
 */
export const narrative = {
  choiceButton: (page: Page, choiceId: string) => page.getByTestId(`choice-${choiceId}`),
  anyChoice: (page: Page) => page.locator('[data-testid^="choice-"]'),
  nthChoice: (page: Page, n: number) => page.locator('[data-testid^="choice-"]').nth(n),
}

/**
 * Alliance screen selectors
 */
export const alliance = {
  allianceOption: (page: Page, factionId: string) => page.getByTestId(`alliance-${factionId}`),
  anyAllianceOption: (page: Page) => page.locator('[data-testid^="alliance-"]'),
  proceedAloneButton: (page: Page) => page.getByTestId('btn-proceed-alone'),
  formAllianceButton: (page: Page) => page.getByTestId('btn-form-alliance'),
  cancelAllianceButton: (page: Page) => page.getByTestId('btn-cancel-alliance'),
}

/**
 * Card pool screen selectors
 */
export const cardPool = {
  card: (page: Page, cardId: string) => page.getByTestId(`card-${cardId}`),
  anyCard: (page: Page) => page.locator('[data-testid^="card-"]'),
  commitFleetButton: (page: Page) => page.getByTestId('btn-commit-fleet'),
  selectionCount: (page: Page) => page.locator('.selection-count .count'),
}

/**
 * Deployment screen selectors
 */
export const deployment = {
  slot: (page: Page, position: number) => page.getByTestId(`slot-${position}`),
  anySlot: (page: Page) => page.locator('[data-testid^="slot-"]'),
  lockOrdersButton: (page: Page) => page.getByTestId('btn-lock-orders'),
  unassignedCards: (page: Page) => page.locator('.unassigned-cards [data-testid^="card-"]'),
}

/**
 * Battle screen selectors
 */
export const battle = {
  viewConsequencesButton: (page: Page) => page.getByTestId('btn-view-consequences'),
  resultBanner: (page: Page) => page.locator('.result-banner'),
  victoryBanner: (page: Page) => page.locator('.result-banner--victory'),
  defeatBanner: (page: Page) => page.locator('.result-banner--defeat'),
  roundIndicator: (page: Page) => page.locator('.round-indicator'),
}

/**
 * Consequence screen selectors
 */
export const consequence = {
  continueButton: (page: Page) => page.getByTestId('btn-continue'),
  outcomeBadge: (page: Page) => page.locator('.outcome-badge'),
  victoryBadge: (page: Page) => page.locator('.outcome-badge--victory'),
  defeatBadge: (page: Page) => page.locator('.outcome-badge--defeat'),
}

/**
 * Common UI elements
 */
export const common = {
  gameHeader: (page: Page) => page.locator('.game-header'),
  modal: (page: Page) => page.getByRole('dialog'),
  heading: (page: Page, text: string | RegExp) => page.getByRole('heading', { name: text }),
  button: (page: Page, text: string | RegExp) => page.getByRole('button', { name: text }),
}

/**
 * Error handling selectors
 */
export const errors = {
  toast: (page: Page) => page.getByTestId('error-toast'),
  message: (page: Page) => page.getByTestId('error-message'),
  dismissButton: (page: Page) => page.getByTestId('btn-dismiss-error'),
}
