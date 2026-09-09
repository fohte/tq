import { TimeBlockCard } from '#components/task/time-block-card'
import { useRemoveFromDayQueue } from '#hooks/use-queues'
import type { TaskDetail } from '#hooks/use-tasks'
import { useDeleteManualTimeBlock } from '#hooks/use-time-blocks'
import { formatLocalDate } from '#lib/date-range'

type TimeBlockItem = TaskDetail['timeBlocks'][number]

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
  const { onDelete, isDeleting } = useDeleteManualTimeBlock(taskId, block.id)

  return (
    <TimeBlockCard block={block} isDeleting={isDeleting} onDelete={onDelete} />
  )
}

// A deleted-but-still-queued task gets a fresh auto block on the next
// auto-assign run (api/src/routes/schedule-auto-assign.ts), so this drops
// it from the queue instead of deleting the block record.
function AutoTimeBlockRow({
  taskId,
  block,
}: {
  taskId: string
  block: TimeBlockItem
}) {
  const { onDelete, isDeleting } = useRemoveFromDayQueue(
    taskId,
    formatLocalDate(new Date(block.startTime)),
  )

  return (
    <TimeBlockCard block={block} isDeleting={isDeleting} onDelete={onDelete} />
  )
}
