import { useQuery } from '@tanstack/react-query'

import { getTaskPreview } from '#hooks/task-preview-batcher'
import { taskPreviewKeys } from '#lib/query-keys'

export function useTaskPreview(id: string, enabled = true) {
  return useQuery({
    queryKey: taskPreviewKeys.preview(id),
    queryFn: () => getTaskPreview(id),
    enabled,
    retry: false,
    staleTime: 60_000,
    throwOnError: (error) => {
      console.error('Failed to load task preview', error)
      return false
    },
  })
}
