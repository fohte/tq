/**
 * Client-side filter for tasks based on context. Used where a task list
 * isn't already server-filtered, so a cross-context item is redacted rather
 * than dropped (unlike Google Calendar events, which the server filters out
 * entirely).
 */
export function matchesContextFilter(
  taskContext: string,
  currentContext: 'work' | 'personal',
): boolean {
  return taskContext === currentContext
}
