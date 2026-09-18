import { defineConfig, devices } from '@playwright/test'

// Read-only UI smoke checks against the seeded local application.
// Login and access audit records are the only writes; no clinical fixture is changed.
export default defineConfig({
  testDir: './seed-e2e', outputDir: './seed-test-results', workers: 1,
  fullyParallel: false, timeout: 45000,
  use: { baseURL: process.env.SEED_BASE_URL || 'http://127.0.0.1:8000', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env.CI ? undefined : process.env.PLAYWRIGHT_CHANNEL || 'chrome' } }],
  reporter: 'list',
})
