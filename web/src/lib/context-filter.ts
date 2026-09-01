/**
 * Client-side filter for tasks based on context. Used where a task list
 * isn't already server-filtered (e.g. calendar events, which are redacted
 * rather than dropped).
 */
export function matchesContextFilter(
  taskContext: string,
  currentContext: 'work' | 'personal',
): boolean {
  return taskContext === currentContext
}
