import { screenshot } from '@storycap-testrun/browser'
import { afterEach, beforeEach, vi } from 'vitest'
import { page } from 'vitest/browser'

// Pin the clock so stories that read the current time (calendar "now"
// indicators, relative timestamps, "today" fixtures built at module scope)
// render identically regardless of when the VRT suite runs.
vi.setSystemTime(new Date('2026-03-10T10:15:00+09:00'))

// The browser page is shared across story files within a worker, so
// localStorage written by one story (e.g. seeding a settings key) would
// otherwise leak into whichever story runs next.
beforeEach(() => {
  localStorage.clear()
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
  await screenshot(page, context)
})
