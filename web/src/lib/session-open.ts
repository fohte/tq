export interface SessionOpenSettings {
  // The context this machine is treated as. `null` means unset, in which
  // case every session is treated as reachable (fail open — most users won't
  // configure this, and they should still get the copy-command fallback).
  localContext: 'work' | 'personal' | null
  // URL templates, expanded with `{sessionId}` when set. Left to the user to
  // point at whatever they've registered locally (a custom URL scheme, an
  // automation tool, ...); tq never inspects the resolved URL.
  focusUrlTemplate: string | null
  resumeUrlTemplate: string | null
}

export type SessionOpenAction =
  { kind: 'url'; url: string } | { kind: 'copy'; text: string }

export function canOpenSessionLocally(
  sessionContext: string,
  localContext: SessionOpenSettings['localContext'],
): boolean {
  return localContext == null || sessionContext === localContext
}

// Active sessions resume via a "focus" action, ended ones via "resume" — the
// two map to different armyknife commands (`a cc focus` / `a cc resume`), so
// a configured template must pick the same way.
export function resolveSessionOpenAction(
  sessionId: string,
  active: boolean,
  settings: Pick<SessionOpenSettings, 'focusUrlTemplate' | 'resumeUrlTemplate'>,
): SessionOpenAction {
  const template = active
    ? settings.focusUrlTemplate
    : settings.resumeUrlTemplate

  if (template != null && template !== '') {
    return {
      kind: 'url',
      url: template.replaceAll('{sessionId}', encodeURIComponent(sessionId)),
    }
  }

  return { kind: 'copy', text: `claude --resume ${sessionId}` }
}
