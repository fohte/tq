import { useQueries } from '@tanstack/react-query'

import { useProjects } from '#hooks/use-projects'
import { fetchTaskDetail, taskKeys } from '#hooks/use-task-queries'

export interface SearchScopeLabel {
  token: string
  label: string
}

export function useSearchScopeLabels(
  scopeTokens: string[],
  enabled: boolean,
): SearchScopeLabel[] {
  const projectIds = uniqueScopeValues(scopeTokens, 'project')
  const parentIds = uniqueScopeValues(scopeTokens, 'parent')
  const { data: projects } = useProjects(undefined, {
    enabled: enabled && projectIds.length > 0,
  })
  const parentQueries = useQueries({
    queries: parentIds.map((id) => ({
      queryKey: taskKeys.detail(id),
      queryFn: () => fetchTaskDetail(id),
      enabled,
    })),
  })

  const projectsById = new Map(
    projects?.map((project) => [project.id, project]),
  )
  const parentsById = new Map(
    parentIds.map((id, index) => [id, parentQueries[index]?.data]),
  )

  return scopeTokens.map((token) => {
    const [type, rawValue = ''] = splitScopeToken(token)
    const value = unquoteScopeValue(rawValue)

    if (type === 'project') {
      const project = projectsById.get(value)
      return {
        token,
        label: project == null ? token : `project:${project.title}`,
      }
    }

    if (type === 'parent') {
      const task = parentsById.get(value)
      return {
        token,
        label:
          task == null ? token : `parent:#${String(task.number)} ${task.title}`,
      }
    }

    return { token, label: token }
  })
}

function uniqueScopeValues(scopeTokens: string[], type: string): string[] {
  return [
    ...new Set(
      scopeTokens
        .filter((token) => token.startsWith(`${type}:`))
        .map((token) => unquoteScopeValue(token.slice(type.length + 1))),
    ),
  ]
}

function splitScopeToken(token: string): [string, string?] {
  const separatorIndex = token.indexOf(':')
  return separatorIndex === -1
    ? [token]
    : [token.slice(0, separatorIndex), token.slice(separatorIndex + 1)]
}

function unquoteScopeValue(value: string): string {
  const quote = value[0]
  return (quote === '"' || quote === "'") && value.endsWith(quote)
    ? value.slice(1, -1)
    : value
}
