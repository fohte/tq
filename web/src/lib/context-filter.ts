/**
 * Client-side filter for tasks based on context. Used where a task list
 * isn't already server-filtered.
 */
export function matchesContextFilter(
  taskContext: string,
  currentContext: 'work' | 'personal',
): boolean {
  return taskContext === currentContext
}
