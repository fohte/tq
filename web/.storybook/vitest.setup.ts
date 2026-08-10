import { screenshot } from '@storycap-testrun/browser'
import { afterEach, beforeEach, vi } from 'vitest'
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

function injectStyle(css: string): void {
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)
}

// The native text-input caret blinks on an OS timer, so a captured frame of a
// focused input/contenteditable is on or off at random — same content, different
// pixels between runs. Hiding it keeps captures deterministic without touching
// application code.
injectStyle(
  'input, textarea, [contenteditable] { caret-color: transparent !important; }',
)

// CSS animations/transitions (popup open/close fades, zooms, spinners, ...)
// capture at whatever frame happens to be on screen when the screenshot
// fires, so the same story rasterizes differently between runs even though
// nothing about it actually changed. Forcing zero duration collapses every
// animation/transition to its end state instantly, keeping captures
// deterministic without touching application code.
injectStyle(`
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
  }
`)

// @storycap-testrun/browser ships a bundled .d.ts with its own copy of
// vitest's `TestContext`, so it's structurally close but nominally unrelated
// to ours — cast through `unknown` to sidestep the resulting type error.
function asScreenshotContext(
  context: unknown,
): Parameters<typeof screenshot>[1] {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- see comment above
  return context as Parameters<typeof screenshot>[1]
}

// A story that loads a non-same-origin http(s) resource (e.g. a remote
// avatar image) races the capture against that request's completion over the
// real network, so the same story can rasterize differently between runs.
// Failing the test surfaces this instead of letting it show up as unstable
// screenshot diffs; fix stories by inlining the resource as a data URI.
const externalResourceUrls: string[] = []

function isExternalResourceUrl(url: string): boolean {
  const { protocol, origin } = new URL(url)
  return (
    (protocol === 'http:' || protocol === 'https:') &&
    origin !== window.location.origin
  )
}

new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (isExternalResourceUrl(entry.name)) {
      externalResourceUrls.push(entry.name)
    }
  }
}).observe({ type: 'resource', buffered: true })

beforeEach(() => {
  externalResourceUrls.length = 0
})

afterEach(async (context) => {
  await screenshot(page, asScreenshotContext(context))

  if (externalResourceUrls.length > 0) {
    const urls = externalResourceUrls.join('\n')
    externalResourceUrls.length = 0
    throw new Error(
      `Story loaded non-same-origin resource(s), which makes VRT captures flaky:\n${urls}`,
    )
  }
})
