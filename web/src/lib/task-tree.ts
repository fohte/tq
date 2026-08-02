import type { Task } from '#hooks/use-tasks'

/**
 * Collect the ids of every descendant of `id` within `tasks` (children,
 * grandchildren, ...). Used to keep a task from being reparented under
 * itself or one of its own descendants.
 */
export function getDescendantIds(tasks: Task[], id: string): string[] {
  return tasks
    .filter((t) => t.parentId === id)
    .flatMap((child) => [child.id, ...getDescendantIds(tasks, child.id)])
}
