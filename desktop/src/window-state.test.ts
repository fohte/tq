import { describe, expect, it } from 'vitest'

import {
  clampWindowBounds,
  createWindowBoundsStore,
  initialWindowBounds,
  parseWindowBounds,
} from '#window-state'

describe('window bounds storage', () => {
  it('saves bounds as JSON', () => {
    let serialized = ''
    const bounds = { x: 1240, y: 40, width: 320, height: 900 }
    const store = createWindowBoundsStore({
      read: () => serialized,
      write: (value) => {
        serialized = value
      },
    })

    expect(
      store.save(bounds).match(
        () => serialized,
        () => 'failed',
      ),
    ).toBe('{"x":1240,"y":40,"width":320,"height":900}')
  })

  it('restores saved bounds', () => {
    const bounds = { x: 1240, y: 40, width: 320, height: 900 }
    const store = createWindowBoundsStore({
      read: () => '{"x":1240,"y":40,"width":320,"height":900}',
      write: () => {},
    })

    expect(
      store.load().match(
        (value) => value,
        () => undefined,
      ),
    ).toEqual(bounds)
  })

  it('uses defaults when the saved value is missing', () => {
    expect(parseWindowBounds(undefined)).toBeUndefined()
  })

  it('uses defaults when the saved width is zero', () => {
    expect(
      parseWindowBounds({ x: 10, y: 20, width: 0, height: 300 }),
    ).toBeUndefined()
  })

  it('uses defaults when a saved coordinate has the wrong type', () => {
    expect(
      parseWindowBounds({ x: '10', y: 20, width: 320, height: 300 }),
    ).toBeUndefined()
  })
})

describe('initialWindowBounds', () => {
  it('places the default narrow window at the right edge of the work area', () => {
    expect(
      initialWindowBounds({ x: 100, y: 50, width: 1440, height: 900 }),
    ).toEqual({ x: 1220, y: 50, width: 320, height: 900 })
  })
})

describe('clampWindowBounds', () => {
  it('keeps restored bounds visible when the previous display is unavailable', () => {
    expect(
      clampWindowBounds(
        { x: 1600, y: -500, width: 500, height: 1200 },
        { x: 0, y: 40, width: 1280, height: 800 },
      ),
    ).toEqual({ x: 780, y: 40, width: 500, height: 800 })
  })
})
