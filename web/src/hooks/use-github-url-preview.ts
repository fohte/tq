import { useQuery } from '@tanstack/react-query'

import type { ResolveGithubUrlResult } from '#hooks/use-github-link'
import { api } from '#lib/api'
import { githubUrlPreviewKeys } from '#lib/query-keys'

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

export function useGithubUrlPreview(url: string, enabled = true) {
  return useQuery({
    ...githubUrlPreviewQueryOptions(url),
    enabled,
    // A non-2xx response above already resolves to `null` without throwing;
    // reaching here means `queryFn` itself threw (network error, bad JSON,
    // ...), which is unexpected and worth surfacing for debugging. The chip
    // still falls back to the raw matched text either way, so this only
    // logs — it must not throw to an error boundary.
    throwOnError: (error) => {
      console.error('Failed to load GitHub URL preview', error)
      return false
    },
  })
}
