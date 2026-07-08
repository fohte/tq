import { fileURLToPath } from 'node:url'

import { defineConfig, devices } from '@playwright/test'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

const WEB_PORT = 5173
const API_PORT = 3001
const isCI = process.env['CI'] != null && process.env['CI'] !== ''

export default defineConfig({
  testDir: './tests',
  // These tests share the tq_test database across a single run (unlike the
  // vitest integration tests, there's no per-test transaction rollback), and
  // several scenarios operate on "today's" queue/auto-assign, which is keyed
  // by date rather than by test. Parallel workers would race on that shared
  // state, so tests run serially.
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? 'github' : 'list',
  globalSetup: './global-setup.ts',
  use: {
    baseURL: `http://localhost:${String(WEB_PORT)}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter api run dev',
      cwd: repoRoot,
      url: `http://localhost:${String(API_PORT)}/health`,
      reuseExistingServer: false,
      env: { APP_ENV: 'test' },
    },
    {
      command: 'pnpm --filter web run dev',
      cwd: repoRoot,
      url: `http://localhost:${String(WEB_PORT)}`,
      reuseExistingServer: false,
    },
  ],
})
