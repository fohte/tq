import { ContextBadge } from '#components/search/context-badge'
import { StatusIcon } from '#components/task/status-icon'
import { DotSeparatedList } from '#components/ui/dot-separated-list'
import type { SearchResult } from '#hooks/use-search'
import { formatMinutes } from '#lib/format'
import { cn } from '#lib/utils'

export function searchResultRowWrapperClassName(
  status: SearchResult['status'],
) {
  return cn(
    'flex items-center gap-2 border-b border-border border-l-2 border-l-transparent px-3 py-2',
    status === 'in_progress' && 'border-l-primary bg-card',
    status === 'completed' && 'dim-completed',
  )
}

export function SearchResultRow({ task }: { task: SearchResult }) {
  const isCompleted = task.status === 'completed'
  const estimate =
    task.estimatedMinutes != null ? formatMinutes(task.estimatedMinutes) : null

  return (
    <>
      <StatusIcon status={task.status} />

      <span className="hidden shrink-0 font-mono text-2xs text-muted-foreground-faint md:inline">
        #{task.number}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5 md:flex-row md:items-center md:gap-2">
        <span
          className={cn(
            'truncate text-sm',
            isCompleted && 'text-muted-foreground line-through',
          )}
        >
          {task.title}
        </span>
        <span className="font-mono text-2xs text-muted-foreground-faint md:hidden">
          <DotSeparatedList items={[`#${String(task.number)}`, estimate]} />
        </span>
      </div>

      <span className="hidden shrink-0 md:inline-flex">
        <ContextBadge context={task.context} />
      </span>

      {estimate != null && (
        <span className="hidden shrink-0 text-right font-mono text-xs text-muted-foreground-strong md:inline">
          {estimate}
        </span>
      )}
    </>
  )
}
