import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { TaskPage } from '#hooks/use-task-pages'
import { formatRelativeTime } from '#lib/format'

const SAVED_TIME_TICK_MS = 30_000

export function PageBreadcrumb({
  isLoading,
  taskNumber,
  page,
}: {
  isLoading: boolean
  taskNumber: number | undefined
  page: TaskPage | undefined
}) {
  // "saved Xm ago" is only recomputed on render, so tick periodically to
  // keep it from drifting while the tab stays open and focused.
  useNowTick(SAVED_TIME_TICK_MS)

  if (isLoading) {
    return <Loader2 className="size-4 animate-spin text-muted-foreground" />
  }

  if (!page) {
    return (
      <span className="font-mono text-xs text-muted-foreground">
        Page not found
      </span>
    )
  }

  return (
    <>
      {taskNumber !== undefined && (
        <span className="shrink-0 font-mono text-xs text-muted-foreground">
          #{taskNumber}
        </span>
      )}
      <span className="shrink-0 text-muted-foreground-ghost">/</span>
      <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium text-foreground">
        {page.title}
      </span>
      <span className="ml-auto shrink-0 font-mono text-2xs text-muted-foreground-ghost">
        saved {formatRelativeTime(page.updatedAt)}
      </span>
    </>
  )
}

function useNowTick(intervalMs: number) {
  const [, forceRerender] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      forceRerender((n) => n + 1)
    }, intervalMs)
    return () => {
      clearInterval(id)
    }
  }, [intervalMs])
}
