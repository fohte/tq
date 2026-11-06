import { describe, expect, it } from 'vitest'

import { getSearchSyntaxHelpSections } from '#components/search/search-syntax-help-data'
import { makePrioritySettings } from '#components/task/priority-settings-test-fixtures'

describe('getSearchSyntaxHelpSections', () => {
  it('documents sort:priority in task-filter syntax help', () => {
    const sortEntry = getSearchSyntaxHelpSections({ audience: 'task-filter' })
      .find(({ title }) => title === 'Filters')
      ?.entries.find(({ syntax }) => syntax === 'sort:')

    expect(sortEntry).toEqual({
      key: 'sort',
      syntax: 'sort:',
      description: 'Sort results by date or configured priority.',
      taskFilter: true,
      values: [
        { syntax: 'sort:due', display: 'Sort by due date' },
        { syntax: 'sort:created', display: 'Sort by creation date' },
        { syntax: 'sort:updated', display: 'Sort by update date' },
        { syntax: 'sort:priority', display: 'Sort by priority' },
        {
          syntax: 'sort:priority-updated',
          display: 'Sort by priority, then update date',
        },
      ],
    })
  })

  it('documents sort:priority in search syntax help', () => {
    const sortEntry = getSearchSyntaxHelpSections()
      .find(({ title }) => title === 'Filters')
      ?.entries.find(({ syntax }) => syntax === 'sort:')

    expect(sortEntry).toEqual({
      key: 'sort',
      syntax: 'sort:',
      description: 'Sort results by date or configured priority.',
      taskFilter: true,
      values: [
        { syntax: 'sort:due', display: 'Sort by due date' },
        { syntax: 'sort:created', display: 'Sort by creation date' },
        { syntax: 'sort:updated', display: 'Sort by update date' },
        { syntax: 'sort:priority', display: 'Sort by priority' },
        {
          syntax: 'sort:priority-updated',
          display: 'Sort by priority, then update date',
        },
      ],
    })
  })

  it('uses neutral priority labels before settings load', () => {
    const priorityEntry = getSearchSyntaxHelpSections({
      audience: 'task-filter',
    })
      .find(({ title }) => title === 'Filters')
      ?.entries.find(({ syntax }) => syntax === 'priority:')

    expect(priorityEntry).toEqual({
      key: 'priority',
      syntax: 'priority:',
      description: 'Limit tasks by priority value.',
      taskFilter: true,
      values: [
        { syntax: 'priority:2', display: 'Priority 2' },
        { syntax: 'priority:1', display: 'Priority 1' },
        { syntax: 'priority:0', display: 'Priority 0' },
        { syntax: 'priority:none', display: 'Inbox' },
        { syntax: 'priority:-1', display: 'Priority -1' },
      ],
    })
  })

  it('documents priority DSL values with configured display names', () => {
    const names = ['Amber', 'Blue', 'Coral', 'Green', 'Silver']
    const settings = makePrioritySettings().map((setting, index) => ({
      ...setting,
      name: names[index] ?? setting.name,
      sortOrder: 4 - index,
    }))
    const priorityEntry = getSearchSyntaxHelpSections({
      audience: 'task-filter',
      prioritySettings: settings,
    })
      .find(({ title }) => title === 'Filters')
      ?.entries.find(({ syntax }) => syntax === 'priority:')

    expect(priorityEntry).toEqual({
      key: 'priority',
      syntax: 'priority:',
      description:
        'Limit tasks by priority value. Display names follow your priority settings.',
      taskFilter: true,
      values: [
        { syntax: 'priority:-1', display: 'Silver' },
        { syntax: 'priority:none', display: 'Green' },
        { syntax: 'priority:0', display: 'Coral' },
        { syntax: 'priority:1', display: 'Blue' },
        { syntax: 'priority:2', display: 'Amber' },
      ],
    })
  })
})
