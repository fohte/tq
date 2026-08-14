import type { TaskSortBy } from '#hooks/use-tasks'

export const sortOptionValues = [
  'updated',
  'created',
] as const satisfies readonly TaskSortBy[]

export interface TasksFilterState {
  sortBy: TaskSortBy
  showCompleted: boolean
  projectId: string | undefined
}

// Must match api/src/search-query-parser.ts's token vocabulary (`is:` /
// `sort:` / `project:`) — parseTasksQuery below decodes it back.
export function buildTasksQuery(state: TasksFilterState): string {
  const parts: string[] = []
  if (!state.showCompleted) parts.push('is:todo', 'is:in_progress')
  // Always included, even for the default 'updated': the API falls back to
  // sorting by `created` when no sort is specified at all.
  parts.push(`sort:${state.sortBy}`)
  if (state.projectId != null) parts.push(`project:${state.projectId}`)
  return parts.join(' ')
}

export function parseTasksQuery(q: string): TasksFilterState {
  let sortBy: TaskSortBy = 'updated'
  // Absence of an `is:` token means "no status filter" (buildTasksQuery
  // above omits them entirely for showCompleted: true), not "unset".
  let showCompleted = true
  let projectId: string | undefined

  for (const token of q.split(/\s+/).filter((t) => t !== '')) {
    const colonIndex = token.indexOf(':')
    if (colonIndex === -1) continue
    const prefix = token.slice(0, colonIndex)
    const value = token.slice(colonIndex + 1)

    switch (prefix) {
      case 'is':
        if (value === 'todo' || value === 'in_progress') showCompleted = false
        break
      case 'sort': {
        const matched = sortOptionValues.find((v) => v === value)
        if (matched != null) sortBy = matched
        break
      }
      case 'project':
        if (value !== '') projectId = value
        break
    }
  }

  return { sortBy, showCompleted, projectId }
}
