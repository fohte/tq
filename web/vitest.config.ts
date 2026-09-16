import fs from 'node:fs'
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

// A test needs a real DOM if it renders components (@testing-library/react,
// @testing-library/user-event) or touches browser globals directly
// (document, window, sessionStorage, ...); everything else is plain logic
// that runs faster under Node. Classifying by content instead of a
// hand-maintained list means a new test file lands on the right project
// automatically.
const DOM_USAGE_PATTERN =
  /from ['"]@testing-library\/(?:react|user-event)['"]|\b(?:document|window|navigator|sessionStorage|localStorage|HTMLElement|Element|Storage|Range)\.|\bResizeObserver\b/

function findTestFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return findTestFiles(fullPath)
    return /\.test\.tsx?$/.test(entry.name) ? [fullPath] : []
  })
}

const srcDir = path.join(dirname, 'src')
const browserTestFiles = findTestFiles(srcDir)
  .filter((file) => DOM_USAGE_PATTERN.test(fs.readFileSync(file, 'utf-8')))
  .map((file) => path.relative(dirname, file).split(path.sep).join('/'))

export default defineConfig({
  resolve: { alias },
  test: {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- withTailwind casts through `any`, see comment above its definition
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'node',
          environment: 'node',
          exclude: [...configDefaults.exclude, ...browserTestFiles],
          // Pin a non-UTC offset so tests asserting local<->UTC conversion
          // (e.g. date-range.test.ts) can't pass by accident when the host
          // machine happens to run in UTC.
          env: { TZ: 'Asia/Tokyo' },
        },
      },
      {
        plugins: [tailwindcss()],
        test: {
          name: 'browser',
          include: browserTestFiles,
          setupFiles: ['./src/browser-test-setup.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
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
