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

// POSIX single-quote wrapping: end the quoted string, emit an escaped quote,
// reopen it. The resume command is pasted straight into a shell, so a raw
// sessionId containing a space or quote would otherwise word-split.
function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

export function canOpenSessionLocally(
  sessionContext: string,
  localContext: SessionOpenSettings['localContext'],
): boolean {
  return localContext == null || sessionContext === localContext
}

// Active sessions focus an already-running process, while ended ones resume
// a new one, so a configured template picks the corresponding action.
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

  return { kind: 'copy', text: `claude --resume ${shellQuote(sessionId)}` }
}
