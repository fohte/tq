import { useQuery } from '@tanstack/react-query'

import { type ProjectDetail, projectKeys } from '#hooks/use-projects'
import { api } from '#lib/api'

export type ProjectUrlPreview = ProjectDetail

const projectUrlPreviewKeyPrefix = [
  ...projectKeys.all,
  'project-url-preview',
] as const

export const projectUrlPreviewKeys = {
  preview: (id: string) => [...projectUrlPreviewKeyPrefix, id] as const,
}

function projectUrlPreviewQueryOptions(id: string) {
  return {
    queryKey: projectUrlPreviewKeys.preview(id),
    queryFn: async (): Promise<ProjectUrlPreview | null> => {
      const res = await api.api.projects[':id'].$get({ param: { id } })
      // A 404 here means the id doesn't match a project; the caller just
      // leaves the match as plain text, no error surfaced.
      if (res.status === 404) return null
      return res.json()
    },
    // A 404 above already resolves to `null` without throwing — retrying
    // the same request would just 404 again.
    retry: false,
    staleTime: 60_000,
  }
}

export function useProjectUrlPreview(id: string) {
  return useQuery({
    ...projectUrlPreviewQueryOptions(id),
    // A 404 above already resolves to `null` without throwing; reaching
    // here means `queryFn` itself threw (network error, bad JSON, ...),
    // which is unexpected and worth surfacing for debugging. The chip still
    // falls back to the raw matched text either way, so this only logs — it
    // must not throw to an error boundary.
    throwOnError: (error) => {
      console.error('Failed to load project URL preview', error)
      return false
    },
  })
}
