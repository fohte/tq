import { type QueryClient, useQuery } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { useDebounce } from '#hooks/use-debounce'
import { type TaskDetail, taskKeys } from '#hooks/use-tasks'
import { api } from '#lib/api'

export type MentionSuggestion = InferResponseType<
  typeof api.api.tasks.mentions.$get,
  200
>[number]

const mentionPreviewKeyPrefix = [...taskKeys.all, 'mention-preview'] as const

export const taskMentionKeys = {
  preview: (number: number) => [...mentionPreviewKeyPrefix, number] as const,
  suggestions: (query: string) =>
    [...taskKeys.all, 'mention-suggestions', query] as const,
}

export function isTaskMentionPreviewKey(queryKey: readonly unknown[]): boolean {
  return mentionPreviewKeyPrefix.every((part, i) => queryKey[i] === part)
}

function taskMentionPreviewQueryOptions(number: number) {
  return {
    queryKey: taskMentionKeys.preview(number),
    queryFn: async (): Promise<TaskDetail | null> => {
      const res = await api.api.tasks[':id'].$get({
        param: { id: String(number) },
      })
      if (res.status === 404) return null
      return res.json()
    },
    // A 404 here means the mentioned number doesn't exist; retrying the
    // same request would just 404 again.
    retry: false,
    staleTime: 60_000,
  }
}

export function useTaskMentionPreview(number: number) {
  return useQuery(taskMentionPreviewQueryOptions(number))
}

// Reads a mention preview straight from the cache without subscribing. The
// live-preview decoration plugin calls this synchronously while computing
// decorations, since it redraws by dispatching a transaction rather than
// through a React re-render.
export function getCachedTaskMentionPreview(
  queryClient: QueryClient,
  number: number,
): TaskDetail | null | undefined {
  return queryClient.getQueryData(taskMentionKeys.preview(number))
}

export function ensureTaskMentionPreviewLoaded(
  queryClient: QueryClient,
  number: number,
): void {
  const queryKey = taskMentionKeys.preview(number)
  // The decoration plugin calls this on every keystroke throughout the
  // whole document for every not-yet-ready mention, so a query that's
  // already failed must not be retried on every single one of those calls.
  if (queryClient.getQueryState(queryKey)?.status === 'error') return

  void queryClient
    .fetchQuery(taskMentionPreviewQueryOptions(number))
    .catch((error: unknown) => {
      // Surfaced to callers as a cached `undefined`/never-resolved entry; the
      // mention just stays as plain text.
      console.error('Failed to load task mention preview', error)
    })
}

export function useTaskMentionSuggestions(query: string, enabled: boolean) {
  const debouncedQuery = useDebounce(query, 150)
  return useQuery({
    queryKey: taskMentionKeys.suggestions(debouncedQuery),
    queryFn: async () => {
      const res = await api.api.tasks.mentions.$get({
        query: { q: debouncedQuery },
      })
      return res.json()
    },
    enabled,
  })
}
