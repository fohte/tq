import { describe, expect, it } from 'vitest'

import { createSideWindowSettingsStore } from '#side-window-settings'

describe('side window settings storage', () => {
  it('saves the always-on-top setting as JSON', () => {
    let serialized = ''
    const store = createSideWindowSettingsStore({
      read: () => serialized,
      write: (value) => {
        serialized = value
      },
    })

    expect(
      store.save({ alwaysOnTop: true }).match(
        () => serialized,
        () => undefined,
      ),
    ).toEqual('{"alwaysOnTop":true}')
  })

  it('restores the always-on-top setting', () => {
    const store = createSideWindowSettingsStore({
      read: () => '{"alwaysOnTop":true}',
      write: () => {},
    })

    expect(
      store.load().match(
        (settings) => settings,
        () => undefined,
      ),
    ).toEqual({ alwaysOnTop: true })
  })

  it('treats an invalid setting as missing', () => {
    const store = createSideWindowSettingsStore({
      read: () => '{"alwaysOnTop":"yes"}',
      write: () => {},
    })

    expect(
      store.load().match(
        (settings) => settings,
        () => undefined,
      ),
    ).toEqual(undefined)
  })
})
