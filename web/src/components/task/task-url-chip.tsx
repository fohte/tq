import { TaskPreviewChip } from '#components/task/task-preview-chip'
import { useTaskUrlPreview } from '#hooks/use-task-url-preview'
import type { TaskUrlData } from '#lib/inline-reference/providers/task-url'

export function TaskUrlChip({
  data,
  raw,
  defaultOpen,
}: {
  data: TaskUrlData
  raw: string
  defaultOpen?: boolean | undefined
}) {
  const { data: task } = useTaskUrlPreview(data.id)
  return (
    <TaskPreviewChip task={task ?? null} raw={raw} defaultOpen={defaultOpen} />
  )
}
