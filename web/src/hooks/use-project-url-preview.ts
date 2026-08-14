import { useQuery } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { projectKeys } from '#hooks/use-projects'
import { api } from '#lib/api'

export type ProjectUrlPreview = InferResponseType<
  (typeof api.api.projects)['resolve-url']['$post'],
  200
>

const projectUrlPreviewKeyPrefix = [
  ...projectKeys.all,
  'project-url-preview',
] as const

export const projectUrlPreviewKeys = {
  preview: (url: string) => [...projectUrlPreviewKeyPrefix, url] as const,
}

function projectUrlPreviewQueryOptions(url: string) {
  return {
    queryKey: projectUrlPreviewKeys.preview(url),
    queryFn: async (): Promise<ProjectUrlPreview | null> => {
      const res = await api.api.projects['resolve-url'].$post({
        json: { url },
      })
      // A non-2xx here means the URL isn't a resolvable tq project (wrong
      // domain, unknown id, ...); the caller just leaves the match as plain
      // text, no error surfaced.
      if (!res.ok) return null
      return res.json()
    },
    // queryFn only throws on a genuine fetch/parse failure — a non-ok
    // response above already resolves to `null` without throwing. Skip the
    // default retry/backoff too, so a transient failure falls straight to
    // the null fallback instead of adding delay.
    retry: false,
    staleTime: 60_000,
  }
}

export function useProjectUrlPreview(url: string) {
  return useQuery({
    ...projectUrlPreviewQueryOptions(url),
    // A non-2xx response above already resolves to `null` without throwing;
    // reaching here means `queryFn` itself threw (network error, bad JSON,
    // ...), which is unexpected and worth surfacing for debugging. The chip
    // still falls back to the raw matched text either way, so this only
    // logs — it must not throw to an error boundary.
    throwOnError: (error) => {
      console.error('Failed to load project URL preview', error)
      return false
    },
  })
}
