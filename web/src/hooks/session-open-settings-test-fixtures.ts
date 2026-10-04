import type { SessionOpenSettings } from '#lib/session-open'

const STORAGE_KEY = 'tq:session-open-settings'

const defaults: SessionOpenSettings = {
  localContext: 'personal',
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
