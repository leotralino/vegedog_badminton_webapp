import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    storageState: 'playwright/.auth/user1.json',
    trace: 'on-first-retry',
  },
  globalSetup: './tests/global-setup.ts',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})

// Helper: reference a test user's auth state by 1-based index
// Usage in tests: test.use({ storageState: authAs(3) })
export function authAs(n: number) {
  return `playwright/.auth/user${n}.json`
}
