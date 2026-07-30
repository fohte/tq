import { GithubUrlChip } from '#components/task/github-url-chip'
import {
  ensureGithubUrlPreviewLoaded,
  getCachedGithubUrlPreview,
  isGithubUrlPreviewKey,
} from '#hooks/use-github-url-preview'
import type { InlineReferenceProvider } from '#lib/inline-reference/types'
import { queryClient } from '#lib/query-client'

export interface GithubUrlData {
  url: string
}

// Scans for a GitHub issue/PR URL's path shape only (`/issues/N` or
// `/pull/N`); the API's `parseGithubIssueUrl` is the authoritative validator,
// so this only needs to be permissive enough to trigger a resolve attempt.
// Stops before a trailing path segment (`/comments`), query string, or
// fragment, leaving that suffix as plain trailing text next to the chip.
const GITHUB_ISSUE_OR_PR_URL_PATTERN =
  /https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/(?:issues|pull)\/\d+\/?(?![\w/])/g

export const githubUrlProvider: InlineReferenceProvider<GithubUrlData> = {
  id: 'github-url',

  findMatches(text) {
    const matches = []
    for (const match of text.matchAll(GITHUB_ISSUE_OR_PR_URL_PATTERN)) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        raw: match[0],
        data: { url: match[0] },
      })
    }
    return matches
  },

  isReady(data) {
    return getCachedGithubUrlPreview(queryClient, data.url) != null
  },

  ensureLoaded(data) {
    ensureGithubUrlPreviewLoaded(queryClient, data.url)
  },

  subscribe(notify) {
    return queryClient.getQueryCache().subscribe((event) => {
      // Same widen-then-narrow reasoning as taskMentionProvider.subscribe:
      // `event.query.queryKey` is typed `any` by @tanstack/query-core.
      const queryKey: unknown = event.query.queryKey
      if (Array.isArray(queryKey) && isGithubUrlPreviewKey(queryKey)) {
        notify()
      }
    })
  },

  Chip: GithubUrlChip,
}
