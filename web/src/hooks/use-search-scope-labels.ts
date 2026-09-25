import { useQueries } from '@tanstack/react-query'
import { parseSearchQuery } from 'api/search-query-parser'

import { fetchProjectDetail, projectKeys } from '#hooks/use-projects'
import { fetchTaskDetail, taskKeys } from '#hooks/use-task-queries'

export interface SearchScopeLabel {
  token: string
  label: string
}

export function useSearchScopeLabels(
  scopeTokens: string[],
  enabled: boolean,
): SearchScopeLabel[] {
  const parsedTokens = scopeTokens.map((token) => ({
    token,
    query: parseSearchQuery(token),
  }))
  const projectIds = uniqueScopeValues(
    parsedTokens.map(({ query }) => query.projectId),
  )
  const parentIds = uniqueScopeValues(
    parsedTokens.map(({ query }) => query.parentId),
  )
  const projectQueries = useQueries({
    queries: projectIds.map((id) => ({
      queryKey: projectKeys.detail(id),
      queryFn: () => fetchProjectDetail(id),
      enabled,
    })),
  })
  const parentQueries = useQueries({
    queries: parentIds.map((id) => ({
      queryKey: taskKeys.detail(id),
      queryFn: () => fetchTaskDetail(id),
      enabled,
    })),
  })

  const projectsById = new Map(
    projectIds.map((id, index) => [id, projectQueries[index]?.data]),
  )
  const parentsById = new Map(
    parentIds.map((id, index) => [id, parentQueries[index]?.data]),
  )

  return parsedTokens.map(({ token, query }) => {
    if (query.projectId != null) {
      const project = projectsById.get(query.projectId)
      return {
        token,
        label: project == null ? token : `project:${project.title}`,
      }
    }

    if (query.parentId != null) {
      const task = parentsById.get(query.parentId)
      return {
        token,
        label:
          task == null ? token : `parent:#${String(task.number)} ${task.title}`,
      }
    }

    return { token, label: token }
  })
}

function uniqueScopeValues(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => value != null))]
}
