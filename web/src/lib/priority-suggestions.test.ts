import { describe, expect, it } from 'vitest'

import { makeSuggestion } from '#components/search/search-test-fixtures'
import { makePrioritySettings } from '#components/task/priority-settings-test-fixtures'
import { applyPrioritySettingsToSuggestions } from '#lib/priority-suggestions'

describe('applyPrioritySettingsToSuggestions', () => {
  it('uses configured names and sort order while preserving DSL values', () => {
    const configuredNames = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon']
    const settings = makePrioritySettings().map((setting, index) => ({
      ...setting,
      name: configuredNames[index] ?? setting.name,
      sortOrder: 4 - index,
    }))
    const suggestions = [
      makeSuggestion({
        value: 'priority:2',
        display: 'Priority 2',
        category: 'priority',
      }),
      makeSuggestion({
        value: 'priority:1',
        display: 'Priority 1',
        category: 'priority',
      }),
      makeSuggestion({
        value: 'priority:0',
        display: 'Priority 0',
        category: 'priority',
      }),
      makeSuggestion({
        value: 'priority:none',
        display: 'Inbox',
        category: 'priority',
      }),
      makeSuggestion({
        value: 'priority:-1',
        display: 'Priority -1',
        category: 'priority',
      }),
      makeSuggestion({
        value: 'sort:priority',
        display: 'Sort by priority',
        category: 'sort',
      }),
    ]

    expect(applyPrioritySettingsToSuggestions(suggestions, settings)).toEqual([
      { value: 'priority:-1', display: 'Epsilon', category: 'priority' },
      { value: 'priority:none', display: 'Delta', category: 'priority' },
      { value: 'priority:0', display: 'Gamma', category: 'priority' },
      { value: 'priority:1', display: 'Beta', category: 'priority' },
      { value: 'priority:2', display: 'Alpha', category: 'priority' },
      { value: 'sort:priority', display: 'Sort by priority', category: 'sort' },
    ])
  })
})
