import { screenshot } from '@storycap-testrun/browser'
import { afterEach, beforeEach, vi } from 'vitest'
import { page } from 'vitest/browser'

import { resetSessionOpenSettings } from '#hooks/session-open-settings-test-fixtures'

// Pin the clock so stories that read the current time (calendar "now"
// indicators, relative timestamps, "today" fixtures built at module scope)
// render identically regardless of when the VRT suite runs.
vi.setSystemTime(new Date('2026-03-10T10:15:00+09:00'))

// Real browser localStorage persists across stories in the same run, so a
// story reads whatever a previously-run story last wrote there (e.g.
// SessionRow's `localContext: 'work'`). Reset before every story so
// useCurrentContext() resolves to the 'personal' default deterministically;
// stories that need 'work' call resetSessionOpenSettings() themselves.
beforeEach(() => {
  resetSessionOpenSettings()
})

// Milkdown throws contextNotFound during async cleanup when unmounting.
// This is a library limitation, not an application bug.

function hasCode(value: unknown, code: string): boolean {
  if (value == null || typeof value !== 'object' || !('code' in value)) {
    return false
  }

  return value.code === code
}

window.addEventListener('error', (event) => {
  if (hasCode(event.error, 'contextNotFound')) {
    event.preventDefault()
  }
})

window.addEventListener('unhandledrejection', (event) => {
  if (hasCode(event.reason, 'contextNotFound')) {
    event.preventDefault()
  }
})

// @storycap-testrun/browser ships a bundled .d.ts with its own copy of
// vitest's `TestContext`, so it's structurally close but nominally unrelated
// to ours — cast through `unknown` to sidestep the resulting type error.
function asScreenshotContext(
  context: unknown,
): Parameters<typeof screenshot>[1] {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- see comment above
  return context as Parameters<typeof screenshot>[1]
}

// Playwright's own caret-hiding mutation runs with no wait for it to paint,
// so this settles pending repaints before that capture step runs.
async function waitForPaint(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve()
      })
    })
  })
}

afterEach(async (context) => {
  await waitForPaint()
  await screenshot(page, asScreenshotContext(context))
})
