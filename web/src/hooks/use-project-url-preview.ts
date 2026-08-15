import { useQuery } from '@tanstack/react-query'

import { type ProjectDetail, projectKeys } from '#hooks/use-projects'
import { api } from '#lib/api'

export type ProjectUrlPreview = ProjectDetail

// Uses its own key namespace instead of projectKeys.detail(id): a
// 404/failed lookup caches `null` here, which would be unsound to share
// with useProject's cache — callers there assume a non-null ProjectDetail.
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
      // A non-2xx here means the id doesn't match a project or the request
      // otherwise failed; the caller just leaves the match as plain text,
      // no error surfaced.
      if (!res.ok) return null
      return res.json()
    },
    // queryFn only throws on a genuine fetch/parse failure (network error,
    // bad JSON, ...) — the non-ok → `null` path above resolves successfully
    // and never triggers a retry. Skip the default retry/backoff too, so a
    // transient failure falls straight to the null fallback instead of
    // adding delay.
    retry: false,
    staleTime: 60_000,
  }
}

export function useProjectUrlPreview(id: string) {
  return useQuery({
    ...projectUrlPreviewQueryOptions(id),
    // A non-2xx above already resolves to `null` without throwing; reaching
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
