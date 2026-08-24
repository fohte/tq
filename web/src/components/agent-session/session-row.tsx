import { useCallback, useEffect, useRef, useState } from 'react'

import { Chip } from '#components/ui/chip'
import { Input } from '#components/ui/input'
import {
  type AgentSession,
  isAgentSessionActive,
  useUpdateAgentSessionCustomLabel,
} from '#hooks/use-agent-sessions'
import { formatMinutes, formatRelativeTime } from '#lib/format'
import { cn } from '#lib/utils'

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
  sessionId,
  label,
}: {
  sessionId: string
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
        id: sessionId,
        customLabel: trimmed === '' ? null : trimmed,
      })
    }
    setIsEditing(false)
  }, [value, label, sessionId, updateCustomLabel])

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

export function SessionRow({
  session,
  isDimmed,
}: {
  session: AgentSession
  isDimmed: boolean
}) {
  const active = isAgentSessionActive(session)
  const label = session.customLabel ?? session.label

  return (
    <div className="flex items-center gap-2 border-b border-border px-3.5 py-1">
      <SessionStatusDot active={active} />
      <div
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3',
          isDimmed && 'opacity-55',
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate font-mono text-xs text-foreground">
            {session.cwd}
          </span>
          <EditableSessionLabel sessionId={session.id} label={label} />
          <Chip className="shrink-0">{session.context}</Chip>
        </div>
        <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
          {formatRelativeTime(session.lastActiveAt)}
        </span>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">
          {formatMinutes(durationMinutes(session))}
        </span>
      </div>
    </div>
  )
}
