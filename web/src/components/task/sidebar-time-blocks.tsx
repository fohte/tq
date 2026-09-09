import { useQueryClient } from '@tanstack/react-query'

import { TimeBlockCard } from '#components/task/time-block-card'
import {
  DAY_QUEUE_KEY,
  useQueueItems,
  useSetQueueItems,
} from '#hooks/use-queues'
import type { TaskDetail } from '#hooks/use-tasks'
import { taskKeys } from '#hooks/use-tasks'
import { useDeleteTimeBlock } from '#hooks/use-time-blocks'
import { formatLocalDate } from '#lib/date-range'

type TimeBlockItem = TaskDetail['timeBlocks'][number]

// No empty state: unlike Pages/Linked Tasks (user-authored content worth
// prompting for), time blocks are schedule-derived, so an empty list just
// means nothing has been scheduled yet.
export function SidebarTimeBlocks({
  taskId,
  timeBlocks,
}: {
  taskId: string
  timeBlocks: TaskDetail['timeBlocks']
}) {
  if (timeBlocks.length === 0) return null

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3.5">
      <span className="font-mono text-2xs text-muted-foreground-faint">
        TIME BLOCKS
      </span>
      <div className="flex flex-col gap-1.5">
        {timeBlocks.map((block) =>
          block.isAutoScheduled ? (
            <AutoTimeBlockRow key={block.id} taskId={taskId} block={block} />
          ) : (
            <ManualTimeBlockRow key={block.id} taskId={taskId} block={block} />
          ),
        )}
      </div>
    </div>
  )
}

function ManualTimeBlockRow({
  taskId,
  block,
}: {
  taskId: string
  block: TimeBlockItem
}) {
  const queryClient = useQueryClient()
  const deleteTimeBlock = useDeleteTimeBlock()

  return (
    <TimeBlockCard
      block={block}
      isDeleting={deleteTimeBlock.isPending}
      onDelete={() => {
        deleteTimeBlock.mutate(block.id, {
          onSuccess: () => {
            void queryClient.invalidateQueries({
              queryKey: taskKeys.detail(taskId),
            })
          },
        })
      }}
    />
  )
}

// Deleting the block record alone doesn't stick: the next auto-assign run
// reads the day queue, sees this task still schedulable, and recreates it
// (see api/src/routes/schedule-auto-assign.ts). Dropping the task from that
// day's queue instead is what actually keeps it from coming back.
function AutoTimeBlockRow({
  taskId,
  block,
}: {
  taskId: string
  block: TimeBlockItem
}) {
  const localDate = formatLocalDate(new Date(block.startTime))
  const dayQueueItems = useQueueItems(DAY_QUEUE_KEY, localDate)
  const setQueueItems = useSetQueueItems()

  return (
    <TimeBlockCard
      block={block}
      isDeleting={setQueueItems.isPending || dayQueueItems.isLoading}
      onDelete={() => {
        setQueueItems.mutate({
          key: DAY_QUEUE_KEY,
          date: localDate,
          taskIds: (dayQueueItems.data ?? [])
            .map((item) => item.taskId)
            .filter((id) => id !== taskId),
        })
      }}
    />
  )
}
