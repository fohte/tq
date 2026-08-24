import { STORAGE_KEY } from '#hooks/use-session-open-settings'
import type { SessionOpenSettings } from '#lib/session-open'

const defaults: SessionOpenSettings = {
  localContext: null,
  focusUrlTemplate: null,
  resumeUrlTemplate: null,
}

export function resetSessionOpenSettings(
  overrides: Partial<SessionOpenSettings> = {},
): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...defaults, ...overrides }),
  )
}
