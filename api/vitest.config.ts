import { defineConfig } from 'vitest/config'

import { resolveTestDatabaseUrl } from '#resolve-test-database-url'

// Set APP_ENV before any imports so that globalSetup files also see it.
// vitest's test.env only applies to test file contexts, not globalSetup.
process.env['APP_ENV'] = 'test'

// Push routes refuse to run without a VAPID keypair (see #services/push).
// `web-push` itself is mocked in tests, so these need not be real keys.
process.env['VAPID_PUBLIC_KEY'] = 'test-vapid-public-key'
process.env['VAPID_PRIVATE_KEY'] = 'test-vapid-private-key'
// Keep file fixtures independent of ASSET_MAX_SIZE_BYTES in the caller's shell.
process.env['ASSET_MAX_SIZE_BYTES'] = String(10 * 1024 * 1024)

// mise's [env] resolves DATABASE_URL to tq_api_dev; tests must use
// tq_api_test instead, so prefer TEST_DATABASE_URL when it is set.
const resolvedDatabaseUrl = resolveTestDatabaseUrl(
  process.env['DATABASE_URL'],
  process.env['TEST_DATABASE_URL'],
)
if (resolvedDatabaseUrl != null) {
  process.env['DATABASE_URL'] = resolvedDatabaseUrl
}

export default defineConfig({
  test: {
    // Spelled out (matching Vitest's own default) so knip's static analysis
    // of this file can resolve test entry files; Vitest's own runtime
    // behavior is unchanged.
    include: ['**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    globalSetup: ['./src/global-setup.ts'],
  },
})
