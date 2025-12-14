import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: './tests/playwright-report' }]],

  // Increase timeout for full game playthroughs
  timeout: 120 * 1000, // 2 minutes per test
  expect: {
    timeout: 10 * 1000, // 10 seconds for assertions
  },

  use: {
    baseURL: 'http://localhost:1420',

    // Always record video for playtesting
    video: 'on',

    // Trace and screenshot settings
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',

    // Action timeout
    actionTimeout: 10 * 1000,
  },

  // Output directory for test artifacts
  outputDir: './tests/test-results',

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1420',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})
