import { beforeEach } from 'vitest'
import { page } from 'vitest/browser'

import { MOBILE_VIEWPORT } from '#storybook-config/screenshot-viewports'

beforeEach(async () => {
  await page.viewport(MOBILE_VIEWPORT.width, MOBILE_VIEWPORT.height)
})
