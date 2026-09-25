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
  ignoreAncestorSvgSizing = false,
}: {
  status: Task['status']
  statusReason: Task['statusReason']
  ignoreAncestorSvgSizing?: boolean
}) {
  const completedGlyphSizeClass = ignoreAncestorSvgSizing ? 'size-3' : 'h-3 w-3'
  const iconSizeClass = ignoreAncestorSvgSizing ? 'size-5' : 'h-5 w-5'

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
        <Glyph className={completedGlyphSizeClass} />
      </span>
    )
  }

  return (
    <svg
      viewBox="0 0 20 20"
      className={cn(iconSizeClass, 'shrink-0 text-muted-foreground')}
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
