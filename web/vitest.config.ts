import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import { createStorybookProject } from '@fohte/storybook-addon/vitest-plugin'
import tailwindcss from '@tailwindcss/vite'
import { playwright } from '@vitest/browser-playwright'
import { configDefaults, defineConfig } from 'vitest/config'

import {
  DESKTOP_ONLY_TAG,
  DESKTOP_VIEWPORT,
  MOBILE_ONLY_TAG,
  MOBILE_VIEWPORT,
} from './.storybook/screenshot-viewports'
import { BASE_UI_OPTIMIZE_DEPS } from './base-ui-optimize-deps'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const alias = {
  '@storybook-config': fileURLToPath(new URL('./.storybook', import.meta.url)),
}

// @fohte/storybook-addon's createStorybookProject() builds a fixed plugins
// array with no slot for extra Vite config, so Tailwind and Base UI dependency
// optimization are added here.
//
// Returns `any`: createStorybookProject()'s inferred return type embeds
// vitest's `BrowserProviderOption<T>`, a self-referential generic that
// TypeScript's `exactOptionalPropertyTypes` structural check reports as "two
// different types... unrelated" as soon as an object literal embeds it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see comment above
function withStorybook(
  project: ReturnType<typeof createStorybookProject>,
): any {
  return {
    ...project,
    optimizeDeps: { include: BASE_UI_OPTIMIZE_DEPS },
    plugins: [
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- withStorybook casts through `any`, see comment above its definition
      ...project.plugins,
      tailwindcss(),
    ],
  }
}

const BROWSER_TEST_PATTERN = '**/*.browser.test.{ts,tsx}'

export default defineConfig({
  resolve: { alias },
  test: {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- withStorybook casts through `any`, see comment above its definition
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'node',
          environment: 'node',
          exclude: [...configDefaults.exclude, BROWSER_TEST_PATTERN],
          // Pin a non-UTC offset so tests asserting local<->UTC conversion
          // (e.g. date-range.test.ts) can't pass by accident when the host
          // machine happens to run in UTC.
          env: { TZ: 'Asia/Tokyo' },
        },
      },
      {
        optimizeDeps: { include: BASE_UI_OPTIMIZE_DEPS },
        plugins: [tailwindcss()],
        test: {
          name: 'browser',
          include: [BROWSER_TEST_PATTERN],
          setupFiles: ['./src/browser-test-setup.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
      withStorybook(
        createStorybookProject({
          name: 'storybook',
          rootDir: dirname,
          viewport: DESKTOP_VIEWPORT,
          screenshotsSubdir: 'desktop',
          setupFiles: ['./.storybook/vitest.setup.ts'],
          excludeTags: [MOBILE_ONLY_TAG],
        }),
      ),
      withStorybook(
        createStorybookProject({
          name: 'storybook-mobile',
          rootDir: dirname,
          viewport: MOBILE_VIEWPORT,
          screenshotsSubdir: 'mobile',
          setupFiles: ['./.storybook/vitest.setup.ts'],
          excludeTags: [DESKTOP_ONLY_TAG],
        }),
      ),
    ],
  },
})
