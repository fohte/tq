import { describe, expect, it } from 'vitest'

import { hasTqDesktopUserAgent } from '#lib/is-tq-desktop'

describe('hasTqDesktopUserAgent', () => {
  it('detects the desktop token', () => {
    expect(hasTqDesktopUserAgent('Mozilla/5.0 (Example) TQDesktop')).toBe(true)
  })

  it('does not detect the token in a browser user agent', () => {
    expect(hasTqDesktopUserAgent('Mozilla/5.0 (Example Browser)')).toBe(false)
  })
})
