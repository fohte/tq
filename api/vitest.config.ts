import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vitest/config'

// Set APP_ENV before any imports so that globalSetup files also see it.
// vitest's test.env only applies to test file contexts, not globalSetup.
process.env['APP_ENV'] = 'test'

export default defineConfig({
  resolve: {
    alias: {
      '@api': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globalSetup: ['./src/global-setup.ts'],
  },
})
