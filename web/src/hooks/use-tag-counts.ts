import { useMemo } from 'react'

import { useLabels } from '#hooks/use-labels'
import { useTaskList } from '#hooks/use-tasks'
import type { TagTreeNode } from '#lib/tag-tree'
import { buildTagTree } from '#lib/tag-tree'

/**
 * Tag counts for the whole task set, independent of the tag filter itself,
 * restricted to labels belonging to `context` and nested into a tree by
 * splitting each name on '/'.
 */
export function useTagCounts(context: 'work' | 'personal'): {
  tagTree: TagTreeNode[]
  isLoading: boolean
} {
  const { categorized, isLoading: isTaskListLoading } = useTaskList()
  const { data: labels, isLoading: isLabelsLoading } = useLabels({ context })

  const tagTree = useMemo(() => {
    if (labels == null) return []
    const namesInContext = new Set(labels.map((label) => label.name))
    const tasksInContext = categorized.all.map((task) => ({
      ...task,
      labels: task.labels.filter((label) => namesInContext.has(label)),
    }))
    return buildTagTree(tasksInContext)
  }, [categorized.all, labels])

  return { tagTree, isLoading: isTaskListLoading || isLabelsLoading }
}
