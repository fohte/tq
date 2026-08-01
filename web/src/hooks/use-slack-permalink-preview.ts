import { useQuery } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { taskKeys } from '#hooks/use-tasks'
import { api } from '#lib/api'

export type SlackPermalinkPreview = InferResponseType<
  typeof api.api.slack.resolve.$post,
  200
>['preview']

// Nested under `taskKeys.all` (like `use-github-url-preview.ts`'s
// `githubUrlPreviewKeyPrefix`) for a consistent key shape across inline
// reference providers, even though Slack has no task-link state of its own
// to invalidate alongside.
const slackPermalinkPreviewKeyPrefix = [
  ...taskKeys.all,
  'slack-permalink-preview',
] as const

export const slackPermalinkPreviewKeys = {
  preview: (url: string) => [...slackPermalinkPreviewKeyPrefix, url] as const,
}

function slackPermalinkPreviewQueryOptions(url: string) {
  return {
    queryKey: slackPermalinkPreviewKeys.preview(url),
    queryFn: async (): Promise<SlackPermalinkPreview | null> => {
      const res = await api.api.slack.resolve.$post({ json: { url } })
      // A non-2xx here means the URL isn't a resolvable Slack permalink (not
      // connected, no access, malformed, API error, ...); the caller just
      // leaves the match as plain text, no error surfaced.
      if (!res.ok) return null
      return (await res.json()).preview
    },
    // A non-ok response above already means "not resolvable"; retrying the
    // same request would just repeat it.
    retry: false,
    staleTime: 60_000,
  }
}

export function useSlackPermalinkPreview(url: string) {
  return useQuery({
    ...slackPermalinkPreviewQueryOptions(url),
    // A non-2xx response above already resolves to `null` without throwing;
    // reaching here means `queryFn` itself threw (network error, bad JSON,
    // ...), which is unexpected and worth surfacing for debugging. The chip
    // still falls back to the raw matched text either way, so this only
    // logs — it must not throw to an error boundary.
    throwOnError: (error) => {
      console.error('Failed to load Slack permalink preview', error)
      return false
    },
  })
}
