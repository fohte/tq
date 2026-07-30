import { type QueryClient, useQuery } from '@tanstack/react-query'

import type { ResolveGithubUrlResult } from '#hooks/use-github-link'
import { api } from '#lib/api'

const githubUrlPreviewKeyPrefix = ['github-url-preview'] as const

export const githubUrlPreviewKeys = {
  preview: (url: string) => [...githubUrlPreviewKeyPrefix, url] as const,
}

export function isGithubUrlPreviewKey(queryKey: readonly unknown[]): boolean {
  return githubUrlPreviewKeyPrefix.every((part, i) => queryKey[i] === part)
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

// Reads a URL preview straight from the cache without subscribing. The
// live-preview decoration plugin calls this synchronously while computing
// decorations, since it redraws by dispatching a transaction rather than
// through a React re-render.
export function getCachedGithubUrlPreview(
  queryClient: QueryClient,
  url: string,
): ResolveGithubUrlResult | null | undefined {
  return queryClient.getQueryData(githubUrlPreviewKeys.preview(url))
}

export function ensureGithubUrlPreviewLoaded(
  queryClient: QueryClient,
  url: string,
): void {
  const queryKey = githubUrlPreviewKeys.preview(url)
  // The decoration plugin calls this on every keystroke throughout the
  // whole document for every not-yet-ready URL, so a query that's already
  // failed must not be retried on every single one of those calls.
  if (queryClient.getQueryState(queryKey)?.status === 'error') return

  void queryClient
    .fetchQuery(githubUrlPreviewQueryOptions(url))
    .catch((error: unknown) => {
      // Surfaced to callers as a cached `undefined`/never-resolved entry;
      // the URL just stays as plain text.
      console.error('Failed to load GitHub URL preview', error)
    })
}
