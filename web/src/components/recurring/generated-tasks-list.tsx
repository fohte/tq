import { GeneratedTasksListAppearance } from '#components/recurring/generated-tasks-list-appearance'
import { useInfiniteScrollSentinel } from '#hooks/use-infinite-scroll-sentinel'
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

  const sentinelRef = useInfiniteScrollSentinel({
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  })

  return (
    <GeneratedTasksListAppearance
      tasks={tasks}
      isLoading={isLoading}
      isError={isError}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      isFetchNextPageError={isFetchNextPageError}
      sentinelRef={sentinelRef}
      onRetry={() => {
        void fetchNextPage()
      }}
    />
  )
}
