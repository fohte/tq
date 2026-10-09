import type { TaskListFilter } from '#hooks/use-task-queries'
import type { Task } from '#hooks/use-tasks'

export function selectQueueTaskPlaceholderData(
  previousData: Task[] | undefined,
  previousFilter: TaskListFilter<'full'> | undefined,
  currentIds: string[],
  context: Task['context'],
): Task[] | undefined {
  if (
    currentIds.length === 0 ||
    previousFilter?.context !== context ||
    previousFilter.ids == null
  ) {
    return undefined
  }

  const tasksById = new Map((previousData ?? []).map((task) => [task.id, task]))
  return currentIds
    .map((id) => tasksById.get(id))
    .filter((task): task is Task => task != null)
}
