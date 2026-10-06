import {
  createJsonStore,
  type JsonStore,
  type JsonStoreStorage,
} from '#json-store'

export type SideWindowSettings = {
  alwaysOnTop: boolean
}

export type SideWindowSettingsStore = JsonStore<SideWindowSettings>

const parseSideWindowSettings = (
  value: unknown,
): SideWindowSettings | undefined => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('alwaysOnTop' in value) ||
    typeof value.alwaysOnTop !== 'boolean'
  ) {
    return undefined
  }

  return { alwaysOnTop: value.alwaysOnTop }
}

export const createSideWindowSettingsStore = (
  storage: JsonStoreStorage,
): SideWindowSettingsStore => createJsonStore(storage, parseSideWindowSettings)
