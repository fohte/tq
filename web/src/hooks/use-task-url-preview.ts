import { useQuery } from '@tanstack/react-query'

import { type TaskDetail, taskKeys } from '#hooks/use-tasks'
import { api } from '#lib/api'

export type TaskUrlPreview = TaskDetail

const taskUrlPreviewKeyPrefix = [...taskKeys.all, 'task-url-preview'] as const

export const taskUrlPreviewKeys = {
  preview: (id: string) => [...taskUrlPreviewKeyPrefix, id] as const,
}

function taskUrlPreviewQueryOptions(id: string) {
  return {
    queryKey: taskUrlPreviewKeys.preview(id),
    queryFn: async (): Promise<TaskUrlPreview | null> => {
      const res = await api.api.tasks[':id'].$get({ param: { id } })
      // A 404 here means the id doesn't match a task; the caller just
      // leaves the match as plain text, no error surfaced.
      if (res.status === 404) return null
      return res.json()
    },
    // A 404 above already resolves to `null` without throwing — retrying
    // the same request would just 404 again.
    retry: false,
    staleTime: 60_000,
  }
}

export function useTaskUrlPreview(id: string) {
  return useQuery({
    ...taskUrlPreviewQueryOptions(id),
    // A 404 above already resolves to `null` without throwing; reaching
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
