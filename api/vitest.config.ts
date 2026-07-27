import { defineConfig } from 'vitest/config'

import { resolveTestDatabaseUrl } from '#resolve-test-database-url'

// Set APP_ENV before any imports so that globalSetup files also see it.
// vitest's test.env only applies to test file contexts, not globalSetup.
process.env['APP_ENV'] = 'test'

// mise's [env] loads DATABASE_URL from .env.runtime pointed at tq_dev; tests
// must use tq_test instead, so prefer TEST_DATABASE_URL when it is set.
const resolvedDatabaseUrl = resolveTestDatabaseUrl(
  process.env['DATABASE_URL'],
  process.env['TEST_DATABASE_URL'],
)
if (resolvedDatabaseUrl != null) {
  process.env['DATABASE_URL'] = resolvedDatabaseUrl
}

export default defineConfig({
  test: {
    globalSetup: ['./src/global-setup.ts'],
  },
})
