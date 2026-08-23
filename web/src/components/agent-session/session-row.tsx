import { Chip } from '#components/ui/chip'
import {
  type AgentSession,
  isAgentSessionActive,
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
          <span
            className={cn(
              'flex-1 truncate font-mono text-xs',
              label != null
                ? 'text-muted-foreground'
                : 'text-muted-foreground-faint',
            )}
          >
            {label ?? 'no label'}
          </span>
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
