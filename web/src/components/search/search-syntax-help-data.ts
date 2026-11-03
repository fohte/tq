import { getSearchQueryHelpTokens } from 'api/search-query-parser'

import { SEARCH_MODE_DEFINITIONS } from '#components/search/search-modal-mode'
import type { PrioritySetting } from '#hooks/use-priority-settings'

interface SearchSyntaxHelpEntry {
  syntax: string
  label?: string
  description: string
  values: { syntax: string; display: string }[]
}

export interface SearchSyntaxHelpSection {
  title: string
  entries: SearchSyntaxHelpEntry[]
}

export interface SearchSyntaxHelpOptions {
  audience?: 'search' | 'task-filter'
  disableProjectFilter?: boolean
  disableStatusFilter?: boolean
  disableSortFilter?: boolean
  prioritySettings?: PrioritySetting[]
}

export function getSearchSyntaxHelpSections({
  audience = 'search',
  disableProjectFilter = false,
  disableStatusFilter = false,
  disableSortFilter = false,
  prioritySettings,
}: SearchSyntaxHelpOptions = {}): SearchSyntaxHelpSection[] {
  const queryTokens = getSearchQueryHelpTokens()
  const filterTokens =
    audience === 'task-filter'
      ? queryTokens.filter(
          (token) =>
            token.taskFilter &&
            !(disableProjectFilter && token.key === 'project') &&
            !(disableStatusFilter && token.key === 'is') &&
            !(disableSortFilter && token.key === 'sort'),
        )
      : queryTokens
  const documentedTokens = filterTokens.map((token) => {
    if (token.key !== 'priority') return token

    const settingsBySyntax = new Map(
      prioritySettings?.map((setting) => [
        `priority:${setting.priority === null ? 'none' : String(setting.priority)}`,
        setting,
      ]),
    )
    const originalOrder = new Map(
      token.values.map(({ syntax }, index) => [syntax, index]),
    )
    const values = token.values
      .map((value) => {
        const setting = settingsBySyntax.get(value.syntax)
        return setting == null ? value : { ...value, display: setting.name }
      })
      .sort((left, right) => {
        const leftSetting = settingsBySyntax.get(left.syntax)
        const rightSetting = settingsBySyntax.get(right.syntax)
        if (leftSetting == null || rightSetting == null) {
          if (leftSetting == null && rightSetting == null) {
            return (
              (originalOrder.get(left.syntax) ?? 0) -
              (originalOrder.get(right.syntax) ?? 0)
            )
          }
          return leftSetting == null ? 1 : -1
        }
        return leftSetting.sortOrder - rightSetting.sortOrder
      })

    return {
      ...token,
      description: `${token.description} Display names follow your priority settings.`,
      values,
    }
  })

  const sections: SearchSyntaxHelpSection[] = []
  if (audience === 'search') {
    sections.push({
      title: 'Search targets',
      entries: Object.entries(SEARCH_MODE_DEFINITIONS).map(
        ([prefix, definition]) => ({
          syntax: prefix,
          label: definition.label,
          description: definition.description,
          values: [],
        }),
      ),
    })
  }
  sections.push({ title: 'Filters', entries: documentedTokens })
  return sections
}
