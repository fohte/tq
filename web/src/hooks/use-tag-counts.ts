import { useMemo } from 'react'

import { useTaskList } from '#hooks/use-tasks'
import type { TagCount } from '#lib/tag-filter'
import { computeTagCounts } from '#lib/tag-filter'

/**
 * Tag counts for the whole task set, independent of the context filter and
 * the tag filter itself. Calling `useTaskList()` with no filter reuses the
 * same query cache entry as `useFilteredTaskList` in 'all'/'personal' mode.
 */
export function useTagCounts(): { tagCounts: TagCount[]; isLoading: boolean } {
  const { categorized, isLoading } = useTaskList()
  const tagCounts = useMemo(
    () => computeTagCounts(categorized.all),
    [categorized.all],
  )
  return { tagCounts, isLoading }
}
