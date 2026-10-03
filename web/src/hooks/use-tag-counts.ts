import { useMemo } from 'react'

import { useLabels } from '#hooks/use-labels'
import { useTaskList } from '#hooks/use-tasks'
import type { TagTreeNode } from '#lib/tag-tree'
import { buildTagTree, flattenLabelTree } from '#lib/tag-tree'

/**
 * Tag counts for the whole task set, independent of the tag filter itself,
 * restricted to labels belonging to `context` and nested into a tree by
 * splitting each name on '/'. Labels absent from the task tree are included
 * with count 0 only when `includeOrphanTags` is true.
 */
export function useTagCounts(
  context: 'work' | 'personal',
  includeOrphanTags = false,
): {
  tagTree: TagTreeNode[]
  orphanTagCount: number
  isLoading: boolean
} {
  const {
    categorized,
    data: tasks,
    isLoading: isTaskListLoading,
  } = useTaskList()
  const { data: labels, isLoading: isLabelsLoading } = useLabels({ context })

  const { tagTree, orphanTagCount } = useMemo(() => {
    if (tasks == null || labels == null) {
      return { tagTree: [], orphanTagCount: 0 }
    }
    const namesInContext = new Set(labels.map((label) => label.name))
    const tasksInContext = categorized.all.map((task) => ({
      ...task,
      labels: task.labels.filter((label) => namesInContext.has(label)),
    }))
    const taskTree = buildTagTree(tasksInContext)
    const namesInTaskTree = new Set(flattenLabelTree(taskTree))
    const orphanTagNames = labels
      .map((label) => label.name)
      .filter((name) => !namesInTaskTree.has(name))

    return {
      tagTree: includeOrphanTags
        ? buildTagTree(tasksInContext, orphanTagNames)
        : taskTree,
      orphanTagCount: orphanTagNames.length,
    }
  }, [categorized.all, includeOrphanTags, labels, tasks])

  return {
    tagTree,
    orphanTagCount,
    isLoading: isTaskListLoading || isLabelsLoading,
  }
}
