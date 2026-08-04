import { beforeEach } from 'vitest'
import { page } from 'vitest/browser'

import { DESKTOP_VIEWPORT } from '#storybook-config/screenshot-viewports'

beforeEach(async () => {
  await page.viewport(DESKTOP_VIEWPORT.width, DESKTOP_VIEWPORT.height)
})
