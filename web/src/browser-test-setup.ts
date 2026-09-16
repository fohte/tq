import '#index.css'
import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { page } from '@vitest/browser/context'
import { afterEach, beforeEach } from 'vitest'

import { DESKTOP_VIEWPORT } from '#storybook-config/screenshot-viewports'

// Vitest's browser-mode tester iframe defaults to a narrow width; default to
// desktop so components render their desktop layout unless a test overrides
// it with its own `page.viewport(...)` call.
beforeEach(async () => {
  await page.viewport(DESKTOP_VIEWPORT.width, DESKTOP_VIEWPORT.height)
})

afterEach(() => {
  cleanup()
})
