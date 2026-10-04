import type { SessionOpenSettings } from '#lib/session-open'
import { SESSION_OPEN_SETTINGS_STORAGE_KEY } from '#lib/storage-keys'

const defaults: SessionOpenSettings = {
  localContext: 'personal',
  focusUrlTemplate: null,
  resumeUrlTemplate: null,
}

export function resetSessionOpenSettings(
  overrides: Partial<SessionOpenSettings> = {},
): void {
  localStorage.setItem(
    SESSION_OPEN_SETTINGS_STORAGE_KEY,
    JSON.stringify({ ...defaults, ...overrides }),
  )
}
