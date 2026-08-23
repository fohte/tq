import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import { createStorybookProject } from '@fohte/storybook-addon/vitest-plugin'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

import {
  DESKTOP_ONLY_TAG,
  DESKTOP_VIEWPORT,
  MOBILE_ONLY_TAG,
  MOBILE_VIEWPORT,
} from './.storybook/screenshot-viewports'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const alias = {
  '@storybook-config': fileURLToPath(new URL('./.storybook', import.meta.url)),
}

// @fohte/storybook-addon's createStorybookProject() builds a fixed plugins
// array with no slot for extra Vite plugins, so Tailwind is spliced in here
// instead of passed through.
//
// Returns `any`: createStorybookProject()'s inferred return type embeds
// vitest's `BrowserProviderOption<T>`, a self-referential generic that
// TypeScript's `exactOptionalPropertyTypes` structural check reports as "two
// different types... unrelated" as soon as an object literal embeds it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see comment above
function withTailwind(project: ReturnType<typeof createStorybookProject>): any {
  return {
    ...project,
    plugins: [
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- withTailwind casts through `any`, see comment above its definition
      ...project.plugins,
      tailwindcss(),
    ],
  }
}

export default defineConfig({
  resolve: { alias },
  test: {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- withTailwind casts through `any`, see comment above its definition
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
      withTailwind(
        createStorybookProject({
          name: 'storybook',
          rootDir: dirname,
          viewport: DESKTOP_VIEWPORT,
          screenshotsSubdir: 'desktop',
          setupFiles: ['./.storybook/vitest.setup.ts'],
          excludeTags: [MOBILE_ONLY_TAG],
        }),
      ),
      withTailwind(
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
