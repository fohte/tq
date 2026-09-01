import { useSyncExternalStore } from 'react'

import { getStorageItem, parseJson, setStorageItem } from '#lib/local-storage'
import type { SessionOpenSettings } from '#lib/session-open'

export const STORAGE_KEY = 'tq:session-open-settings'

const DEFAULT_SETTINGS: SessionOpenSettings = {
  localContext: 'personal',
  focusUrlTemplate: null,
  resumeUrlTemplate: null,
}

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
      : DEFAULT_SETTINGS.localContext,
    focusUrlTemplate: toTemplate(record['focusUrlTemplate']),
    resumeUrlTemplate: toTemplate(record['resumeUrlTemplate']),
  }
}

function parseSettings(raw: string | null): SessionOpenSettings {
  if (raw == null) return DEFAULT_SETTINGS
  return parseJson(raw).map(toSettings).unwrapOr(DEFAULT_SETTINGS)
}

// A module-level store (rather than per-instance useState) so every mounted
// consumer — e.g. SessionOpenSettingsPanel and the app-wide useCurrentContext
// callers that stay mounted across navigation — re-renders when one instance
// writes a new value, instead of only the instance that called updateSettings.
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): string | null {
  return getStorageItem(STORAGE_KEY).unwrapOr(null)
}

/**
 * Which machine this browser is on, and how to reopen a session's real CLI
 * process from it, is inherently per-browser — persisted client-side rather
 * than through the API, which has no notion of "this machine" to key on.
 */
export function useSessionOpenSettings() {
  const raw = useSyncExternalStore(subscribe, getSnapshot)
  const settings = parseSettings(raw)

  const updateSettings = (patch: Partial<SessionOpenSettings>) => {
    const next = { ...settings, ...patch }
    // best-effort persistence; keep the in-memory value even if storage write fails
    setStorageItem(STORAGE_KEY, JSON.stringify(next)).unwrapOr(undefined)
    for (const listener of listeners) listener()
  }

  return [settings, updateSettings] as const
}
