import { screenshot } from '@storycap-testrun/browser'
import { afterEach, beforeEach, vi } from 'vitest'
import { page } from 'vitest/browser'

import { externalResourceCheck } from '#storybook-config/checks/external-resource-check'
import { overflowCheck } from '#storybook-config/checks/overflow-check'
import { unhandledApiRequestCheck } from '#storybook-config/checks/unhandled-api-request-check'

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

// Both Vitest's browser-mode TestContext and composeStory()'s return value
// (a composed story is called to render, with `.parameters` etc. attached to
// the callable) are functions at runtime, so `typeof` reports 'function' for
// them, not 'object' — the `in` operator still works on either.
function isRecordLike(value: unknown): value is Record<string, unknown> {
  return (
    (typeof value === 'object' || typeof value === 'function') && value !== null
  )
}

// @storybook/addon-vitest's generated per-story test wrapper assigns
// `context.story = composedStory` before running the story (see its
// vitest-plugin/test-utils.js's testStory()), but ships no type declaration
// for it — narrow through `unknown` to access the story's resolved
// parameters.
function hasStory(
  context: unknown,
): context is { story: { parameters: unknown } } {
  return (
    isRecordLike(context) &&
    'story' in context &&
    isRecordLike(context['story']) &&
    'parameters' in context['story']
  )
}

function storyParametersOf(context: unknown): unknown {
  return hasStory(context) ? context.story.parameters : undefined
}

// Checks that must pass for every story; add a check module under ./checks
// and list it here to register it.
const checks = [externalResourceCheck, unhandledApiRequestCheck, overflowCheck]

beforeEach(() => {
  for (const check of checks) check.reset()
})

afterEach(async (context) => {
  await screenshot(page, asScreenshotContext(context))
  for (const check of checks) check.assert(storyParametersOf(context))
})
