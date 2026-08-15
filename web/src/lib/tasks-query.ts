import type { TaskSortBy } from '#hooks/use-tasks'

export const sortOptionValues = [
  'updated',
  'created',
] as const satisfies readonly TaskSortBy[]

export interface TasksFilterState {
  sortBy: TaskSortBy
  showCompleted: boolean
  projectId: string | undefined
  tag?: string | undefined
  // Tokens outside is:/sort:/project:/label:'s recognized vocabulary (e.g.
  // has:pages, free text, is:completed). Carried through verbatim so editing
  // one known field via buildTasksQuery doesn't drop what the user typed.
  extra?: string | undefined
}

// The default state tasks/index.tsx and sidebar tag links build from —
// "everything not yet done, most-recently-updated first".
export const defaultTasksFilterState: TasksFilterState = {
  sortBy: 'updated',
  showCompleted: false,
  projectId: undefined,
}

// Must match api/src/search-query-parser.ts's token vocabulary (`is:` /
// `sort:` / `project:` / `label:`) — parseTasksQuery below decodes it back.
export function buildTasksQuery(state: TasksFilterState): string {
  const parts: string[] = []
  if (!state.showCompleted) parts.push('is:todo', 'is:in_progress')
  // Always included, even for the default 'updated': the API falls back to
  // sorting by `created` when no sort is specified at all.
  parts.push(`sort:${state.sortBy}`)
  if (state.projectId != null) parts.push(`project:${state.projectId}`)
  if (state.tag != null) parts.push(`label:${state.tag}`)
  if (state.extra != null && state.extra !== '') parts.push(state.extra)
  return parts.join(' ')
}

// The /tasks search for "default filters, scoped to this tag" — shared by
// every tag-token click/link (sidebar, task row, task detail) so they all
// navigate to the same place.
export function tagFilterSearch(tag: string): { q: string } {
  return { q: buildTasksQuery({ ...defaultTasksFilterState, tag }) }
}

export function parseTasksQuery(q: string): TasksFilterState {
  let sortBy: TaskSortBy = 'updated'
  // Absence of an `is:` token means "no status filter" (buildTasksQuery
  // above omits them entirely for showCompleted: true), not "unset".
  let showCompleted = true
  let projectId: string | undefined
  let tag: string | undefined
  const extraTokens: string[] = []

  for (const token of q.split(/\s+/).filter((t) => t !== '')) {
    const colonIndex = token.indexOf(':')
    if (colonIndex === -1) {
      extraTokens.push(token)
      continue
    }
    const prefix = token.slice(0, colonIndex)
    const value = token.slice(colonIndex + 1)

    switch (prefix) {
      case 'is':
        if (value === 'todo' || value === 'in_progress') {
          showCompleted = false
        } else {
          extraTokens.push(token)
        }
        break
      case 'sort': {
        const matched = sortOptionValues.find((v) => v === value)
        if (matched != null) {
          sortBy = matched
        } else {
          extraTokens.push(token)
        }
        break
      }
      case 'project':
        if (value !== '') projectId = value
        else extraTokens.push(token)
        break
      case 'label':
        if (value !== '') tag = value
        else extraTokens.push(token)
        break
      default:
        extraTokens.push(token)
    }
  }

  return {
    sortBy,
    showCompleted,
    projectId,
    tag,
    extra: extraTokens.length > 0 ? extraTokens.join(' ') : undefined,
  }
}
