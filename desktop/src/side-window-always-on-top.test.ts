import { describe, expect, it } from 'vitest'

import { createSideWindowAlwaysOnTopController } from '#side-window-always-on-top'
import { createSideWindowSettingsStore } from '#side-window-settings'

describe('side window always-on-top controller', () => {
  it('applies the loaded setting to a newly created side window', () => {
    const settingsStore = createSideWindowSettingsStore({
      read: () => '{"alwaysOnTop":true}',
      write: () => {},
    })
    const initialSettings = settingsStore.load().match(
      (settings) => settings,
      () => undefined,
    )
    const controller = createSideWindowAlwaysOnTopController({
      initialValue: initialSettings?.alwaysOnTop ?? false,
      settingsStore,
    })
    const appliedValues: boolean[] = []

    controller.applyTo({
      isDestroyed: () => false,
      setAlwaysOnTop: (enabled) => {
        appliedValues.push(enabled)
      },
    })

    expect(appliedValues).toEqual([true])
  })

  it('updates an open window and persists a new setting', () => {
    let serialized = '{"alwaysOnTop":false}'
    const settingsStore = createSideWindowSettingsStore({
      read: () => serialized,
      write: (value) => {
        serialized = value
      },
    })
    const controller = createSideWindowAlwaysOnTopController({
      initialValue: false,
      settingsStore,
    })
    const appliedValues: boolean[] = []
    controller.applyTo({
      isDestroyed: () => false,
      setAlwaysOnTop: (enabled) => {
        appliedValues.push(enabled)
      },
    })

    const saveResult = controller.setEnabled(true)
    const actual = () => [
      appliedValues,
      saveResult.isOk(),
      serialized,
      controller.isEnabled(),
    ]

    expect(actual()).toEqual([
      [false, true],
      true,
      '{"alwaysOnTop":true}',
      true,
    ])
  })
})
