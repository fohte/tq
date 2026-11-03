import { useEffect, useMemo, useRef } from 'react'

import {
  getSearchSyntaxHelpSections,
  type SearchSyntaxHelpOptions,
} from '#components/search/search-syntax-help-data'
import { usePrioritySettings } from '#hooks/use-priority-settings'

export function useSearchSyntaxHelpSections(
  options: Omit<SearchSyntaxHelpOptions, 'prioritySettings'> & {
    enabled: boolean
  },
) {
  const {
    enabled,
    audience = 'search',
    disableProjectFilter = false,
    disableStatusFilter = false,
    disableSortFilter = false,
  } = options
  const prioritySettings = usePrioritySettings({ enabled })
  const loggedError = useRef<unknown>(undefined)

  useEffect(() => {
    const error = prioritySettings.error
    if (!enabled || error == null || loggedError.current === error) return

    loggedError.current = error
    console.error(
      'Failed to load priority settings for search syntax help',
      error,
    )
  }, [enabled, prioritySettings.error])

  return useMemo(
    () =>
      getSearchSyntaxHelpSections({
        audience,
        disableProjectFilter,
        disableStatusFilter,
        disableSortFilter,
        ...(prioritySettings.data == null
          ? {}
          : { prioritySettings: prioritySettings.data }),
      }),
    [
      audience,
      disableProjectFilter,
      disableStatusFilter,
      disableSortFilter,
      prioritySettings.data,
    ],
  )
}
