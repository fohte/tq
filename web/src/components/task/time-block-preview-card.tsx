import { TaskPreviewCard } from '#components/task/task-preview-card'
import type { TaskPreviewChipTask } from '#components/task/task-preview-chip'
import { TimeBlockCard } from '#components/task/time-block-card'
import type { TimeBlock } from '#hooks/use-time-blocks'

/**
 * Stacks the same task preview shown for a `#123` mention on top of the time
 * block's own row, so a calendar chip's hover card identifies the task
 * instead of showing only the block's time range.
 */
export function TimeBlockPreviewCard({
  task,
  block,
  onDelete,
  isDeleting,
}: {
  task: TaskPreviewChipTask | null
  block: Pick<TimeBlock, 'startTime' | 'endTime' | 'isAutoScheduled'>
  onDelete: () => void
  isDeleting?: boolean | undefined
}) {
  return (
    <div className="flex w-72 flex-col gap-2">
      <TaskPreviewCard task={task} raw="" />
      <TimeBlockCard
        block={block}
        onDelete={onDelete}
        isDeleting={isDeleting}
      />
    </div>
  )
}
