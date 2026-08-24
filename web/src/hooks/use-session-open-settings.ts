import { Result } from 'neverthrow'
import { useState } from 'react'

import { getStorageItem, setStorageItem } from '#lib/local-storage'
import type { SessionOpenSettings } from '#lib/session-open'

export const STORAGE_KEY = 'tq:session-open-settings'

const DEFAULT_SETTINGS: SessionOpenSettings = {
  localContext: null,
  focusUrlTemplate: null,
  resumeUrlTemplate: null,
}

const parseJson = Result.fromThrowable(
  (raw: string) => JSON.parse(raw) as unknown,
)

function isContext(value: unknown): value is 'work' | 'personal' {
  return value === 'work' || value === 'personal'
}

function toTemplate(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

// Settings edited through our own UI, so validation here is only a defense
// against a hand-edited or stale localStorage value, not untrusted input.
function toSettings(value: unknown): SessionOpenSettings {
  const record = isRecord(value) ? value : {}
  return {
    localContext: isContext(record['localContext'])
      ? record['localContext']
      : null,
    focusUrlTemplate: toTemplate(record['focusUrlTemplate']),
    resumeUrlTemplate: toTemplate(record['resumeUrlTemplate']),
  }
}

function readSettings(): SessionOpenSettings {
  const raw = getStorageItem(STORAGE_KEY).unwrapOr(null)
  if (raw == null) return DEFAULT_SETTINGS
  return parseJson(raw).map(toSettings).unwrapOr(DEFAULT_SETTINGS)
}

function writeSettings(settings: SessionOpenSettings): void {
  // best-effort persistence; keep the in-memory value even if storage write fails
  setStorageItem(STORAGE_KEY, JSON.stringify(settings)).unwrapOr(undefined)
}

/**
 * Which machine this browser is on, and how to reopen a session's real CLI
 * process from it, is inherently per-browser — persisted client-side rather
 * than through the API, which has no notion of "this machine" to key on.
 */
export function useSessionOpenSettings() {
  const [settings, setSettingsState] = useState(readSettings)

  const updateSettings = (patch: Partial<SessionOpenSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch }
      writeSettings(next)
      return next
    })
  }

  return [settings, updateSettings] as const
}
