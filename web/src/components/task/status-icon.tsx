import { Check, Equal, X } from 'lucide-react'

import type { Task } from '#hooks/use-tasks'
import { cn } from '#lib/utils'

const CLOSE_REASON_GLYPH = {
  completed: Check,
  not_planned: X,
  duplicate: Equal,
}

export function StatusIcon({
  status,
  statusReason,
}: {
  status: Task['status']
  statusReason: Task['statusReason']
}) {
  if (status === 'completed') {
    const reason = statusReason ?? 'completed'
    const Glyph = CLOSE_REASON_GLYPH[reason]
    return (
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-background',
          reason === 'completed'
            ? 'bg-status-completed'
            : 'bg-muted-foreground-faint',
        )}
      >
        <Glyph className="h-3 w-3" />
      </span>
    )
  }

  return (
    <svg
      viewBox="0 0 20 20"
      className="h-5 w-5 shrink-0 text-muted-foreground"
      aria-hidden="true"
    >
      <circle
        cx="10"
        cy="10"
        r="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  )
}
