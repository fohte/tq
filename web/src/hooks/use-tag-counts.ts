import { useMemo } from 'react'

import { useTaskList } from '#hooks/use-tasks'
import type { TagCount } from '#lib/tag-counts'
import { computeTagCounts } from '#lib/tag-counts'

/**
 * Tag counts for the whole task set, independent of the context filter and
 * the tag filter itself.
 */
export function useTagCounts(): { tagCounts: TagCount[]; isLoading: boolean } {
  const { categorized, isLoading } = useTaskList()
  const tagCounts = useMemo(
    () => computeTagCounts(categorized.all),
    [categorized.all],
  )
  return { tagCounts, isLoading }
}
