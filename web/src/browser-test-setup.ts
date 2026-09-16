import '#index.css'
import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { page } from '@vitest/browser/context'
import { afterEach, beforeEach } from 'vitest'

import { DESKTOP_VIEWPORT } from '#storybook-config/screenshot-viewports'

// Vitest's browser-mode tester iframe defaults to a width narrower than the
// desktop breakpoint components branch on (e.g. useIsDesktop()), unlike the
// underlying Playwright page/context, which stays desktop-sized regardless.
// Default every test to a desktop-sized iframe so behavior matches what ran
// under jsdom (which had no layout at all, so matchMedia was stubbed to
// always report desktop); a test can still call `page.viewport(...)` itself
// to exercise a narrower layout.
beforeEach(async () => {
  await page.viewport(DESKTOP_VIEWPORT.width, DESKTOP_VIEWPORT.height)
})

afterEach(() => {
  cleanup()
})
