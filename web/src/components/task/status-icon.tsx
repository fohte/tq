import { Check } from 'lucide-react'

import type { Task } from '#hooks/use-tasks'

export function StatusIcon({ status }: { status: Task['status'] }) {
  if (status === 'completed') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted-foreground-faint text-background">
        <Check className="h-3 w-3" />
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
