import { Check, Terminal, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '#components/ui/button'
import { Chip } from '#components/ui/chip'
import { Input } from '#components/ui/input'
import {
  type AgentSession,
  isAgentSessionActive,
  useUpdateAgentSessionCustomLabel,
} from '#hooks/use-agent-sessions'
import { useSessionOpenSettings } from '#hooks/use-session-open-settings'
import { formatMinutes, formatRelativeTime } from '#lib/format'
import {
  canOpenSessionLocally,
  resolveSessionOpenAction,
  type SessionOpenSettings,
} from '#lib/session-open'
import { cn } from '#lib/utils'

const COPY_FEEDBACK_MS = 1500

function SessionStatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        'size-2 shrink-0 rounded-full',
        active ? 'bg-primary' : 'border border-muted-foreground',
      )}
    />
  )
}

function durationMinutes(session: AgentSession): number {
  const start = new Date(session.startedAt).getTime()
  const end = new Date(session.endedAt ?? session.lastActiveAt).getTime()
  return Math.round((end - start) / 60_000)
}

// Empty input clears the override (falls back to the hook-reported label)
// instead of being rejected, unlike a task title which can't be empty.
function EditableSessionLabel({
  id,
  label,
}: {
  id: string
  label: string | null
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(label ?? '')
  const updateCustomLabel = useUpdateAgentSessionCustomLabel()
  const savingRef = useRef(false)

  useEffect(() => {
    if (!isEditing) setValue(label ?? '')
  }, [label, isEditing])

  const save = useCallback(() => {
    if (savingRef.current) {
      savingRef.current = false
      return
    }
    const trimmed = value.trim()
    if (trimmed !== (label ?? '')) {
      updateCustomLabel.mutate({
        id,
        customLabel: trimmed === '' ? null : trimmed,
      })
    }
    setIsEditing(false)
  }, [value, label, id, updateCustomLabel])

  if (isEditing) {
    return (
      <Input
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
        }}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            savingRef.current = true
            setValue(label ?? '')
            setIsEditing(false)
          }
        }}
        autoFocus
        className="h-auto min-w-0 flex-1 border-0 bg-transparent p-0 font-mono text-xs text-muted-foreground shadow-none focus-visible:ring-0"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setIsEditing(true)
      }}
      className={cn(
        'flex-1 truncate text-left font-mono text-xs',
        label != null ? 'text-muted-foreground' : 'text-muted-foreground-faint',
      )}
    >
      {label ?? 'no label'}
    </button>
  )
}

// A row for a session whose context doesn't match this machine's configured
// context can't act on it — the copied command or opened URL only works on
// the machine the session actually runs on.
function SessionOpenButton({
  sessionId,
  active,
  settings,
}: {
  sessionId: string
  active: boolean
  settings: SessionOpenSettings
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  )
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

  const action = resolveSessionOpenAction(sessionId, active, settings)

  const showCopyFeedback = (state: 'copied' | 'failed') => {
    setCopyState(state)
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => {
      setCopyState('idle')
    }, COPY_FEEDBACK_MS)
  }

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={() => {
        if (action.kind === 'copy') {
          navigator.clipboard.writeText(action.text).then(
            () => {
              showCopyFeedback('copied')
            },
            (error: unknown) => {
              console.error('Failed to copy resume command', error)
              showCopyFeedback('failed')
            },
          )
        } else {
          window.location.href = action.url
        }
      }}
      title={
        copyState === 'copied'
          ? 'Copied'
          : copyState === 'failed'
            ? 'Copy failed — see console'
            : action.kind === 'copy'
              ? `Copy: ${action.text}`
              : `Open: ${action.url}`
      }
      aria-label={active ? 'Focus session' : 'Resume session'}
      className="shrink-0 text-muted-foreground hover:text-foreground"
    >
      {copyState === 'copied' ? (
        <Check className="h-4 w-4" />
      ) : copyState === 'failed' ? (
        <X className="h-4 w-4" />
      ) : (
        <Terminal className="h-4 w-4" />
      )}
    </Button>
  )
}

export function SessionRow({
  session,
  isDimmed,
}: {
  session: AgentSession
  isDimmed: boolean
}) {
  const active = isAgentSessionActive(session)
  const label = session.customLabel ?? session.label
  const [settings] = useSessionOpenSettings()
  const canOpen = canOpenSessionLocally(session.context, settings.localContext)

  return (
    <div className="flex items-center gap-2 border-b border-border px-3.5 py-1">
      <SessionStatusDot active={active} />
      <div
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3',
          (isDimmed || !canOpen) && 'opacity-55',
        )}
      >
        {/* flex-wrap: only the label (via EditableSessionLabel) has flex-1
            (flex-basis 0); cwd keeps its default content-based, nonzero
            basis. When the row can't fit both plus the chip, the shrink
            algorithm assigns cwd the entire deficit and pins the label at
            exactly 0 width instead of splitting the shortage. Wrapping the
            label onto its own line keeps it in the flex-grow branch, where
            it always gets its fair share of space. */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="truncate font-mono text-xs text-foreground">
            {session.cwd}
          </span>
          <EditableSessionLabel id={session.id} label={label} />
          <Chip className="shrink-0">{session.context}</Chip>
        </div>
        <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
          {formatRelativeTime(session.lastActiveAt)}
        </span>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">
          {formatMinutes(durationMinutes(session))}
        </span>
      </div>
      {canOpen && (
        <SessionOpenButton
          sessionId={session.sessionId}
          active={active}
          settings={settings}
        />
      )}
    </div>
  )
}
