import { screenshot } from '@storycap-testrun/browser'
import { afterEach, vi } from 'vitest'
import { page } from 'vitest/browser'

// Pin the clock so stories that read the current time (calendar "now"
// indicators, relative timestamps, "today" fixtures built at module scope)
// render identically regardless of when the VRT suite runs.
vi.setSystemTime(new Date('2026-03-10T10:15:00+09:00'))

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

// Mirrors the element selector Playwright's own screenshot uses to hide
// the caret (input, textarea, [contenteditable]) — narrower than a generic
// "editable target" check so a focused button or <select> (e.g. relying on
// :focus-visible for its own screenshot) doesn't get blurred here too.
function hasCaret(element: Element | null): element is HTMLElement {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLElement && element.isContentEditable)
  )
}

// Playwright hides the caret with a style mutation right before capturing,
// with no wait for it to actually paint, so a story whose play() just
// finished typing can leave a stale caret fragment in the screenshot.
// Blurring first and waiting two rendered frames lets it settle beforehand.
async function settleFocusAndPaint(): Promise<void> {
  const active = document.activeElement
  if (hasCaret(active)) {
    active.blur()
  }
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve()
      })
    })
  })
}

afterEach(async (context) => {
  await settleFocusAndPaint()
  await screenshot(page, asScreenshotContext(context))
})
