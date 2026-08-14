import { TaskPreviewChip } from '#components/task/task-preview-chip'
import { useTaskUrlPreview } from '#hooks/use-task-url-preview'
import type { TaskUrlData } from '#lib/inline-reference/providers/task-url'

export function TaskUrlChip({ data, raw }: { data: TaskUrlData; raw: string }) {
  const { data: task } = useTaskUrlPreview(data.url)
  return <TaskPreviewChip task={task ?? null} raw={raw} />
}
