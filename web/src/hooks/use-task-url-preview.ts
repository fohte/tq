import { useTaskPreview } from '#hooks/use-task-preview'

export function useTaskUrlPreview(id: string) {
  return useTaskPreview(id)
}
