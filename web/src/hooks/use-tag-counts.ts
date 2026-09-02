import { useMemo } from 'react'

import { useLabels } from '#hooks/use-labels'
import { useTaskList } from '#hooks/use-tasks'
import type { TagCount } from '#lib/tag-counts'
import { computeTagCounts } from '#lib/tag-counts'

/**
 * Tag counts for the whole task set, independent of the tag filter itself,
 * restricted to labels belonging to `context`.
 */
export function useTagCounts(context: 'work' | 'personal'): {
  tagCounts: TagCount[]
  isLoading: boolean
} {
  const { categorized, isLoading: isTaskListLoading } = useTaskList()
  const { data: labels, isLoading: isLabelsLoading } = useLabels({ context })

  const tagCounts = useMemo(() => {
    if (labels == null) return []
    const namesInContext = new Set(labels.map((label) => label.name))
    return computeTagCounts(categorized.all).filter((tagCount) =>
      namesInContext.has(tagCount.name),
    )
  }, [categorized.all, labels])

  return { tagCounts, isLoading: isTaskListLoading || isLabelsLoading }
}
