export type ContextFilterMode = 'all' | 'work' | 'personal'

/**
 * Map filter mode to API context values.
 * - 'all' -> undefined (no filter)
 * - 'work' -> 'work'
 * - 'personal' -> 'personal'
 */
export function filterModeToApiContext(
  mode: ContextFilterMode,
): 'work' | 'personal' | undefined {
  switch (mode) {
    case 'work':
      return 'work'
    case 'personal':
      return 'personal'
    case 'all':
      return undefined
  }
}

/**
 * Client-side filter for tasks based on context mode. Used where a task list
 * isn't already server-filtered (e.g. calendar events, which are redacted
 * rather than dropped).
 */
export function matchesContextFilter(
  taskContext: string,
  mode: ContextFilterMode,
): boolean {
  switch (mode) {
    case 'all':
      return true
    case 'work':
      return taskContext === 'work'
    case 'personal':
      return taskContext === 'personal'
  }
}
