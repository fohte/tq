import { useQuery } from '@tanstack/react-query'

import type { ResolveGithubUrlResult } from '#hooks/use-github-link'
import { taskKeys } from '#hooks/use-tasks'
import { api } from '#lib/api'

// Nested under `taskKeys.all` (like `use-task-mentions.ts`'s
// `mentionPreviewKeyPrefix`) so `useGithubSync`'s periodic
// `invalidateQueries({ queryKey: taskKeys.all })` also refreshes a
// `linked: true` preview's task/link state after it changes on GitHub.
const githubUrlPreviewKeyPrefix = [
  ...taskKeys.all,
  'github-url-preview',
] as const

export const githubUrlPreviewKeys = {
  preview: (url: string) => [...githubUrlPreviewKeyPrefix, url] as const,
}

function githubUrlPreviewQueryOptions(url: string) {
  return {
    queryKey: githubUrlPreviewKeys.preview(url),
    queryFn: async (): Promise<ResolveGithubUrlResult | null> => {
      const res = await api.api.github.resolve.$post({ json: { url } })
      // A non-2xx here means the URL isn't a resolvable GitHub issue/PR
      // (not connected, no access, malformed, API error, ...); the caller
      // just leaves the match as plain text, no error surfaced.
      if (!res.ok) return null
      return res.json()
    },
    // A non-ok response above already means "not resolvable"; retrying the
    // same request would just repeat it.
    retry: false,
    staleTime: 60_000,
  }
}

export function useGithubUrlPreview(url: string) {
  return useQuery(githubUrlPreviewQueryOptions(url))
}
