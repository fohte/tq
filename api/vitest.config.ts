import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@api': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globalSetup: ['./src/global-setup.ts'],
    env: {
      APP_ENV: 'test',
    },
  },
})
