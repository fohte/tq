import type { SideWindowSettingsStore } from '#side-window-settings'

type SideWindow = {
  isDestroyed: () => boolean
  setAlwaysOnTop: (alwaysOnTop: boolean) => void
}

type SideWindowAlwaysOnTopOptions = {
  initialValue: boolean
  settingsStore: Pick<SideWindowSettingsStore, 'save'>
}

export const createSideWindowAlwaysOnTopController = ({
  initialValue,
  settingsStore,
}: SideWindowAlwaysOnTopOptions) => {
  let alwaysOnTop = initialValue
  let sideWindow: SideWindow | undefined

  return {
    isEnabled: () => alwaysOnTop,
    applyTo: (window: SideWindow) => {
      sideWindow = window
      window.setAlwaysOnTop(alwaysOnTop)
    },
    setEnabled: (enabled: boolean) => {
      alwaysOnTop = enabled
      if (sideWindow !== undefined && !sideWindow.isDestroyed()) {
        sideWindow.setAlwaysOnTop(enabled)
      }
      return settingsStore.save({ alwaysOnTop: enabled })
    },
  }
}

export type SideWindowAlwaysOnTopController = ReturnType<
  typeof createSideWindowAlwaysOnTopController
>
