import { TaskPreviewCard } from '#components/task/task-preview-card'
import type { TaskPreviewChipTask } from '#components/task/task-preview-chip'
import { TimeBlockCard } from '#components/task/time-block-card'
import type { TimeBlock } from '#hooks/use-time-blocks'

export function TimeBlockPreviewCard({
  task,
  isTaskError,
  block,
  onDelete,
  isDeleting,
}: {
  task: TaskPreviewChipTask | null
  isTaskError?: boolean | undefined
  block: Pick<TimeBlock, 'startTime' | 'endTime' | 'isAutoScheduled'>
  onDelete: () => void
  isDeleting?: boolean | undefined
}) {
  return (
    <div className="flex w-72 flex-col gap-2">
      {isTaskError === true ? (
        <span className="p-3 text-xs text-muted-foreground">
          Failed to load task
        </span>
      ) : (
        <TaskPreviewCard task={task} raw="" />
      )}
      <TimeBlockCard
        block={block}
        onDelete={onDelete}
        isDeleting={isDeleting}
      />
    </div>
  )
}
