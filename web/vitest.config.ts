import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const alias = {
  '@storybook-config': fileURLToPath(new URL('./.storybook', import.meta.url)),
}

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'jsdom',
          setupFiles: ['./src/test-setup.ts'],
          // Pin a non-UTC offset so tests asserting local<->UTC conversion
          // (e.g. date-range.test.ts) can't pass by accident when the host
          // machine happens to run in UTC.
          env: { TZ: 'Asia/Tokyo' },
        },
      },
      {
        plugins: [
          storybookTest({
            configDir: path.join(dirname, '.storybook'),
          }),
        ],
        resolve: { alias },
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            // Pin the browser's timezone so time-dependent stories (calendar
            // "now" indicators, relative timestamps) render identically
            // regardless of the host machine's local timezone.
            provider: playwright({
              contextOptions: { timezoneId: 'Asia/Tokyo' },
            }),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
          setupFiles: ['./.storybook/vitest.setup.ts'],
        },
      },
    ],
  },
})
