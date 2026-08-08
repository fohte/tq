import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import storycap from '@storycap-testrun/browser/vitest-plugin'
import tailwindcss from '@tailwindcss/vite'
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

// @storycap-testrun/browser waits for 500ms of network silence before every
// capture and exposes no option to shorten it, so every story pays that flat
// half second per viewport. Only the floor moves: the window still restarts on
// each resource load, and `document.fonts.ready` plus the metrics-stability
// poll that follow it are untouched.
const NETWORK_IDLE_MS = 100

// Screenshot capture is I/O-bound (network-idle wait, font loading, CDP metric
// polling), not CPU-bound, so workers can oversubscribe past the runner's vCPU
// count. Vitest's browser pool reads `test.maxWorkers` per-project (it doesn't
// fall back to the root config like the default thread pool does), so this is
// set on each storybook project below rather than at the top level.
const STORYBOOK_MAX_WORKERS = 4

// The module arrives here either as the shipped `dist/index.mjs` or as an
// esbuild pre-bundle, which reformats the minified source but keeps the literal.
const NETWORK_IDLE_DEFAULT = /=\s*500\s*\)\s*=>\s*new Promise\(/

const storycapNetworkIdle = {
  name: 'storycap-network-idle',
  transform(code: string, id: string) {
    if (
      !id.includes('@storycap-testrun') ||
      !code.includes('PerformanceObserver')
    ) {
      return null
    }

    const patched = code.replace(NETWORK_IDLE_DEFAULT, (match) =>
      match.replace('500', String(NETWORK_IDLE_MS)),
    )
    if (patched === code) {
      throw new Error(
        `storycap-network-idle: no 500ms network-idle default found in ${id}. Drop this plugin if @storycap-testrun made the wait configurable, otherwise re-derive the pattern.`,
      )
    }

    return patched
  },
}

function createStorybookProject({
  name,
  viewport,
  screenshotsSubdir,
  viewportSetupFile,
}: {
  name: string
  viewport: { width: number; height: number }
  screenshotsSubdir: string
  viewportSetupFile: string
}) {
  return {
    plugins: [
      storycapNetworkIdle,
      tailwindcss(),
      storybookTest({
        configDir: path.join(dirname, '.storybook'),
      }),
      asPlugin(
        storycap({
          viewport,
          output: { dir: path.join(screenshotsDir, screenshotsSubdir) },
        }),
      ),
    ],
    resolve: { alias },
    test: {
      name,
      maxWorkers: STORYBOOK_MAX_WORKERS,
      browser: {
        enabled: true,
        // Pin the browser's timezone so time-dependent stories (calendar
        // "now" indicators, relative timestamps) render identically
        // regardless of the host machine's local timezone.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- asProvider casts through `any`, see comment above its definition
        provider: asProvider(
          playwright({ contextOptions: { timezoneId: 'Asia/Tokyo' } }),
        ),
        headless: true,
        instances: [{ browser: 'chromium' as const }],
      },
      setupFiles: [viewportSetupFile, './.storybook/vitest.setup.ts'],
    },
  }
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
      createStorybookProject({
        name: 'storybook',
        viewport: DESKTOP_VIEWPORT,
        screenshotsSubdir: 'desktop',
        viewportSetupFile: './.storybook/vitest.setup.desktop.ts',
      }),
      createStorybookProject({
        name: 'storybook-mobile',
        viewport: MOBILE_VIEWPORT,
        screenshotsSubdir: 'mobile',
        viewportSetupFile: './.storybook/vitest.setup.mobile.ts',
      }),
    ],
  },
})
