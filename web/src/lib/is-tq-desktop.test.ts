import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  hasTqDesktopUserAgent,
  hasTqDesktopWindowControls,
} from '#lib/is-tq-desktop'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('hasTqDesktopUserAgent', () => {
  it('detects the desktop token', () => {
    expect(hasTqDesktopUserAgent('Mozilla/5.0 (Example) TQDesktop')).toBe(true)
  })

  it('does not detect the token in a browser user agent', () => {
    expect(hasTqDesktopUserAgent('Mozilla/5.0 (Example Browser)')).toBe(false)
  })
})

describe('hasTqDesktopWindowControls', () => {
  it('reads the desktop marker from navigator.userAgent', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Example) TQDesktop',
    })

    expect(hasTqDesktopWindowControls()).toBe(true)
  })

  it('leaves browser layouts unchanged for a browser user agent', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Example Browser)',
    })

    expect(hasTqDesktopWindowControls()).toBe(false)
  })
})
