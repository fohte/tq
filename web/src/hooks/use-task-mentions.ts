import { useQuery } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'
import { useEffect } from 'react'

import { useDebounce } from '#hooks/use-debounce'
import { useTaskPreview } from '#hooks/use-task-preview'
import { api } from '#lib/api'
import { taskMentionKeys } from '#lib/query-keys'

export type MentionSuggestion = InferResponseType<
  typeof api.api.tasks.mentions.$get,
  200
>[number]

export function useTaskMentionPreview(number: number, enabled = true) {
  return useTaskPreview(String(number), enabled)
}

export function useTaskMentionSuggestions(query: string, enabled: boolean) {
  const debouncedQuery = useDebounce(query, 150)
  const result = useQuery({
    queryKey: taskMentionKeys.suggestions(debouncedQuery),
    queryFn: async (): Promise<MentionSuggestion[]> => {
      const res = await api.api.tasks.mentions.$get({
        query: { q: debouncedQuery },
      })
      // The route only ever declares a 200 response, so this is typed as
      // always true — but a framework-level 5xx (unhandled exception,
      // middleware failure, ...) is still possible at runtime. A non-2xx
      // here means the suggestions couldn't be fetched; the menu just shows
      // no results, no error surfaced.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- see above
      if (!res.ok) return []
      return res.json()
    },
    enabled,
    // A non-ok response above already resolves to `[]` without throwing;
    // reaching here means `queryFn` itself threw (network error, bad JSON,
    // ...), which is unexpected — it must not throw to an error boundary,
    // the menu still falls back to no results either way.
    throwOnError: () => false,
  })

  // The menu re-renders on every keystroke (it subscribes to the editor's
  // store), so logging from `throwOnError` directly would re-log the same
  // failure on each render for as long as the query stays errored. Logging
  // only when the error reference changes keeps one log per failure.
  useEffect(() => {
    if (result.error != null) {
      console.error('Failed to load task mention suggestions', result.error)
    }
  }, [result.error])

  return result
}
