import { useState } from 'react'

import { AddRecurringOccurrenceDialog } from '#components/recurring/add-recurring-occurrence-dialog'
import { GeneratedTasksListAppearance } from '#components/recurring/generated-tasks-list-appearance'
import { useInfiniteScrollSentinel } from '#hooks/use-infinite-scroll-sentinel'
import { useCreateRecurringTaskOccurrence } from '#hooks/use-recurring-templates'
import { useInfiniteTaskList } from '#hooks/use-tasks'
import { formatLocalDate } from '#lib/date-range'

export function GeneratedTasksList({ templateId }: { templateId: string }) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [occurrenceDate, setOccurrenceDate] = useState('')
  const [conflictDate, setConflictDate] = useState<string | null>(null)
  const createOccurrence = useCreateRecurringTaskOccurrence()

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
    <>
      <GeneratedTasksListAppearance
        tasks={tasks}
        isLoading={isLoading}
        isError={isError}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        isFetchNextPageError={isFetchNextPageError}
        sentinelRef={sentinelRef}
        onAddTask={() => {
          setOccurrenceDate(formatLocalDate(new Date()))
          setConflictDate(null)
          createOccurrence.reset()
          setIsAddDialogOpen(true)
        }}
        onRetry={() => {
          void fetchNextPage()
        }}
      />
      <AddRecurringOccurrenceDialog
        open={isAddDialogOpen}
        onOpenChange={(open) => {
          if (!open && createOccurrence.isPending) return
          setIsAddDialogOpen(open)
          if (!open) {
            setConflictDate(null)
            createOccurrence.reset()
          }
        }}
        occurrenceDate={occurrenceDate}
        onOccurrenceDateChange={(date) => {
          setOccurrenceDate(date)
          setConflictDate(null)
          createOccurrence.reset()
        }}
        isPending={createOccurrence.isPending}
        error={
          conflictDate != null
            ? `A task for ${conflictDate} already exists.`
            : createOccurrence.isError
              ? 'Failed to add the task.'
              : null
        }
        onSubmit={() => {
          createOccurrence.mutate(
            { templateId, occurrenceDate },
            {
              onSuccess: (result) => {
                if (result.kind === 'conflict') {
                  setConflictDate(occurrenceDate)
                  return
                }
                setIsAddDialogOpen(false)
              },
            },
          )
        }}
      />
    </>
  )
}
