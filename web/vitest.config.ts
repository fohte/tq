import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import storycap from '@storycap-testrun/browser/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

import {
  DESKTOP_VIEWPORT,
  MOBILE_VIEWPORT,
} from './.storybook/screenshot-viewports'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const alias = {
  '@storybook-config': fileURLToPath(new URL('./.storybook', import.meta.url)),
}

// desktop/mobile share this root so reg-suit's `actualDir` can point at one tree.
const screenshotsDir = path.join(dirname, '__screenshots__')

// @storycap-testrun/browser ships a bundled .d.ts with its own copy of vite's
// `Plugin` type, so it's structurally identical but nominally unrelated to
// ours — cast to sidestep the resulting "unrelated types" error. Typing this
// as `Plugin` (instead of `any`) reintroduces a cascading "exactOptionalPropertyTypes"
// mismatch between vite's own `Plugin` and rollup's, so this stays `any` and
// the unsafe-assignment at each call site is suppressed individually instead.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see comment above
function asPlugin(plugin: unknown): any {
  return plugin
}

// `playwright()` returns vitest's own `BrowserProviderOption<PlaywrightProviderOptions>`
// (this is the exact usage vitest's own JSDoc on `browser.provider` recommends), but that
// interface is self-referential (providerFactory -> TestProject -> ProjectConfig ->
// browser.provider -> BrowserProviderOption again). Under `exactOptionalPropertyTypes: true`,
// TypeScript's structural comparison of that recursive generic against the target's
// `BrowserProviderOption<object>` bails out with a spurious "two different types with this
// name exist, but they are unrelated" — cast to sidestep it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see comment above
function asProvider(provider: unknown): any {
  return provider
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- asPlugin casts through `any`, see comment above its definition
        plugins: [
          storybookTest({
            configDir: path.join(dirname, '.storybook'),
          }),
          asPlugin(
            storycap({
              viewport: DESKTOP_VIEWPORT,
              output: { dir: path.join(screenshotsDir, 'desktop') },
            }),
          ),
        ],
        resolve: { alias },
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- asProvider casts through `any`, see comment above its definition
            provider: asProvider(playwright()),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
          setupFiles: [
            './.storybook/vitest.setup.desktop.ts',
            './.storybook/vitest.setup.ts',
          ],
        },
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- asPlugin casts through `any`, see comment above its definition
        plugins: [
          storybookTest({
            configDir: path.join(dirname, '.storybook'),
          }),
          asPlugin(
            storycap({
              viewport: MOBILE_VIEWPORT,
              output: { dir: path.join(screenshotsDir, 'mobile') },
            }),
          ),
        ],
        resolve: { alias },
        test: {
          name: 'storybook-mobile',
          browser: {
            enabled: true,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- asProvider casts through `any`, see comment above its definition
            provider: asProvider(playwright()),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
          setupFiles: [
            './.storybook/vitest.setup.mobile.ts',
            './.storybook/vitest.setup.ts',
          ],
        },
      },
    ],
  },
})
