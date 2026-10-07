import { useMemo } from 'react'

import { useLabelCounts, useLabels } from '#hooks/use-labels'
import type { TagTreeNode } from '#lib/tag-tree'
import { buildTagTreeFromCounts } from '#lib/tag-tree'

/**
 * Tag counts for labels in `context`, nested into a tree by splitting each
 * name on '/'. Labels without assigned tasks are included with count 0 only
 * when `includeOrphanTags` is true.
 */
export function useTagCounts(
  context: 'work' | 'personal',
  includeOrphanTags = false,
): {
  tagTree: TagTreeNode[]
  orphanTagCount: number
  isLoading: boolean
} {
  const { data: counts, isLoading: isCountsLoading } = useLabelCounts(context)
  const { data: labels, isLoading: isLabelsLoading } = useLabels({ context })

  const { tagTree, orphanTagCount } = useMemo(() => {
    if (counts == null || labels == null) {
      return { tagTree: [], orphanTagCount: 0 }
    }
    const namesWithCounts = new Set(counts.map(({ name }) => name))
    const orphanTagNames = labels
      .map((label) => label.name)
      .filter((name) => !namesWithCounts.has(name))

    return {
      tagTree: buildTagTreeFromCounts(
        counts,
        includeOrphanTags ? orphanTagNames : [],
      ),
      orphanTagCount: orphanTagNames.length,
    }
  }, [counts, includeOrphanTags, labels])

  return {
    tagTree,
    orphanTagCount,
    isLoading: isCountsLoading || isLabelsLoading,
  }
}
