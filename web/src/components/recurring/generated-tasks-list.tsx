import { Link } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'

import { DateRangeBadge } from '#components/task/task-row-shared'
import { ListAreaMessage } from '#components/ui/list-area-message'
import { SectionHeading } from '#components/ui/section-heading'
import { useInfiniteTaskList } from '#hooks/use-tasks'

export function GeneratedTasksList({ templateId }: { templateId: string }) {
  const {
    tasks,
    isLoading,
    isError,
    hasNextPage,
    isFetchNextPageError,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteTaskList({
    view: 'row',
    context: 'all',
    status: 'all',
    templateId,
    sortBy: 'due',
    order: 'desc',
  })

  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!hasNextPage) return
    const sentinel = sentinelRef.current
    if (sentinel == null) return

    const observer = new IntersectionObserver((entries) => {
      if (
        entries[0]?.isIntersecting === true &&
        !isFetchingNextPage &&
        !isFetchNextPageError
      ) {
        void fetchNextPage()
      }
    })
    observer.observe(sentinel)
    return () => {
      observer.disconnect()
    }
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage])

  return (
    <div className="flex flex-col gap-2.5">
      <SectionHeading level={3}>Generated tasks</SectionHeading>
      {isLoading ? (
        <ListAreaMessage>Loading...</ListAreaMessage>
      ) : isError && tasks.length === 0 ? (
        <p className="font-mono text-xs text-destructive">
          Failed to load generated tasks.
        </p>
      ) : tasks.length === 0 ? (
        <ListAreaMessage>No tasks generated yet.</ListAreaMessage>
      ) : (
        <div className="border border-border">
          {tasks.map((task) => (
            <Link
              key={task.id}
              to="/tasks/$taskId"
              params={{ taskId: task.id }}
              className="flex items-center gap-2 border-b border-border px-3 py-2 font-mono text-xs hover:bg-card"
            >
              <span className="shrink-0 text-muted-foreground-faint">
                #{task.number}
              </span>
              <span className="flex-1 truncate">{task.title}</span>
              <DateRangeBadge
                startDate={task.startDate}
                dueDate={task.dueDate}
                status={task.status}
              />
              <span className="shrink-0 text-muted-foreground">
                {task.status}
              </span>
            </Link>
          ))}
          {hasNextPage && <div ref={sentinelRef} aria-hidden />}
        </div>
      )}
    </div>
  )
}
