import { useQuery } from '@tanstack/react-query'

import { type TaskDetail, taskKeys } from '#hooks/use-tasks'
import { api } from '#lib/api'

export type TaskUrlPreview = TaskDetail

// Uses its own key namespace instead of taskKeys.detail(id): a 404/failed
// lookup caches `null` here, which would be unsound to share with
// useTask's cache — callers there assume a non-null TaskDetail.
const taskUrlPreviewKeyPrefix = [...taskKeys.all, 'task-url-preview'] as const

export const taskUrlPreviewKeys = {
  preview: (id: string) => [...taskUrlPreviewKeyPrefix, id] as const,
}

function taskUrlPreviewQueryOptions(id: string) {
  return {
    queryKey: taskUrlPreviewKeys.preview(id),
    queryFn: async (): Promise<TaskUrlPreview | null> => {
      const res = await api.api.tasks[':id'].$get({ param: { id } })
      // A non-2xx here means the id doesn't match a task or the request
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

export function useTaskUrlPreview(id: string) {
  return useQuery({
    ...taskUrlPreviewQueryOptions(id),
    // A non-2xx above already resolves to `null` without throwing; reaching
    // here means `queryFn` itself threw (network error, bad JSON, ...),
    // which is unexpected and worth surfacing for debugging. The chip still
    // falls back to the raw matched text either way, so this only logs — it
    // must not throw to an error boundary.
    throwOnError: (error) => {
      console.error('Failed to load task URL preview', error)
      return false
    },
  })
}
