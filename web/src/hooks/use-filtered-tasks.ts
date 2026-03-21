import {
  filterByContext,
  filterModeToApiContext,
  filterTreeByContext,
  useContextFilter,
} from '@web/hooks/use-context-filter'
import { useTaskList, useTaskTree } from '@web/hooks/use-tasks'
import { useMemo } from 'react'

export function useFilteredTaskList() {
  const { mode } = useContextFilter()
  const apiContext = filterModeToApiContext(mode)
  const { isLoading, categorized } = useTaskList(
    apiContext ? { context: apiContext } : undefined,
  )

  const today = useMemo(
    () => filterByContext(categorized.today, mode),
    [categorized.today, mode],
  )
  const all = useMemo(
    () => filterByContext(categorized.all, mode),
    [categorized.all, mode],
  )
  const backlog = useMemo(
    () => filterByContext(categorized.backlog, mode),
    [categorized.backlog, mode],
  )
  const nonBacklog = useMemo(
    () => filterByContext(categorized.nonBacklog, mode),
    [categorized.nonBacklog, mode],
  )

  return { isLoading, today, all, backlog, nonBacklog }
}

export function useFilteredTaskTree(options: { enabled: boolean }) {
  const { mode } = useContextFilter()
  const { data, isLoading } = useTaskTree(options)

  const tree = useMemo(
    () => filterTreeByContext(data ?? [], mode),
    [data, mode],
  )

  return { isLoading, tree }
}
