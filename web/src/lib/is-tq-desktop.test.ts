import { afterEach, describe, expect, it, vi } from 'vitest'

import { hasTqDesktopWindowControls } from '#lib/is-tq-desktop'

afterEach(() => {
  vi.unstubAllGlobals()
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
