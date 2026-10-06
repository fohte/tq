import { TimeBlockCard } from '#components/task/time-block-card'
import type { TaskDetail } from '#hooks/use-tasks'
import { useDeleteTimeBlock } from '#hooks/use-time-blocks'

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
        {timeBlocks.map((block) => (
          <TimeBlockRow key={block.id} taskId={taskId} block={block} />
        ))}
      </div>
    </div>
  )
}

function TimeBlockRow({
  taskId,
  block,
}: {
  taskId: string
  block: TimeBlockItem
}) {
  const { onDelete, isDeleting } = useDeleteTimeBlock(taskId, block.id)

  return (
    <TimeBlockCard block={block} isDeleting={isDeleting} onDelete={onDelete} />
  )
}
