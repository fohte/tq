import { describe, expect, it } from 'vitest'

import { getSearchSyntaxHelpSections } from '#components/search/search-syntax-help-data'

describe('getSearchSyntaxHelpSections', () => {
  it('documents date-based and priority task sorting', () => {
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
      ],
    })
  })
})
