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
  const { enabled, ...helpOptions } = options
  const prioritySettings = usePrioritySettings({ enabled })

  return getSearchSyntaxHelpSections({
    ...helpOptions,
    ...(prioritySettings.data == null
      ? {}
      : { prioritySettings: prioritySettings.data }),
  })
}
