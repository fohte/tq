import { describe, expect, it } from 'vitest'

import { makeSuggestion } from '#components/search/search-test-fixtures'
import { makeGithubLink } from '#components/task/github-link-test-fixtures'
import {
  makeTaskDetail,
  makeTaskWithDescription,
} from '#components/task/task-row-test-fixtures'
import {
  applySuggestionToQuery,
  extractCurrentPrefix,
  resolveSearchContext,
} from '#hooks/use-search'
import {
  extractTaskIdOrNumber,
  taskDetailToSearchResult,
} from '#lib/search-utils'

describe('extractTaskIdOrNumber', () => {
  const host = 'tasks.example'

  it('accepts a bare number', () => {
    expect(extractTaskIdOrNumber('5', host)).toEqual('5')
  })

  it('accepts a hash-prefixed number', () => {
    expect(extractTaskIdOrNumber('#5', host)).toEqual('5')
  })

  it('rejects a non-numeric hash token', () => {
    expect(extractTaskIdOrNumber('#task', host)).toBeUndefined()
  })

  it('rejects a number followed by other text', () => {
    expect(extractTaskIdOrNumber('5 task', host)).toBeUndefined()
  })

  it('rejects an empty query', () => {
    expect(extractTaskIdOrNumber('', host)).toBeUndefined()
  })

  it('accepts task URLs with a number or UUID', () => {
    const uuid = '00000000-0000-4000-8000-000000000011'
    const urls = [`https://${host}/tasks/5`, `https://${host}/tasks/${uuid}`]

    expect(urls.map((url) => extractTaskIdOrNumber(url, host))).toEqual([
      '5',
      uuid,
    ])
  })

  it('accepts a task URL with a trailing slash and fragment', () => {
    expect(
      extractTaskIdOrNumber(`https://${host}/tasks/5/#details`, host),
    ).toEqual('5')
  })

  it('rejects URLs that do not identify exactly one valid task', () => {
    const urls = [
      'https://other.example/tasks/5',
      `https://${host}/tasks/5/details`,
      `https://${host}/tasks/not-a-uuid`,
      `https://${host}/tasks/5 https://${host}/tasks/6`,
    ]

    expect(urls.map((url) => extractTaskIdOrNumber(url, host))).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ])
  })
})

describe('taskDetailToSearchResult', () => {
  it('maps detail relation fields to the list result shape', () => {
    const task = makeTaskDetail({
      duplicateOfNumber: null,
      blockedBy: [
        makeTaskWithDescription({ number: 12 }),
        makeTaskWithDescription({ number: 18 }),
      ],
      githubBlockers: [
        makeGithubLink({
          owner: 'example-owner',
          repo: 'example-repo',
          number: 17,
          role: 'blocker',
          notifyEvents: ['closed'],
          url: 'https://github.com/example-owner/example-repo/issues/17',
        }),
        makeGithubLink({
          owner: 'example-owner',
          repo: 'example-repo',
          number: 18,
          role: 'blocker',
          notifyEvents: ['closed'],
          state: 'closed',
          url: 'https://github.com/example-owner/example-repo/issues/18',
        }),
      ],
    })

    expect(taskDetailToSearchResult(task)).toEqual({
      id: task.id,
      number: task.number,
      title: task.title,
      description: task.description,
      status: task.status,
      statusReason: task.statusReason,
      context: task.context,
      commitment: task.commitment,
      labels: task.labels,
      startDate: task.startDate,
      dueDate: task.dueDate,
      remindAt: task.remindAt,
      parentId: task.parentId,
      parentNumber: task.parentNumber,
      projectId: task.projectId,
      recurrenceRuleId: task.recurrenceRuleId,
      recurrenceRule: task.recurrenceRule,
      templateId: task.templateId,
      occurrenceDate: task.occurrenceDate,
      githubLinks: task.githubLinks,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      childCompletionCount: task.childCompletionCount,
      checklistCompletionCount: task.checklistCompletionCount,
      duplicateOfNumber: null,
      blockedByNumbers: [12, 18],
      blockedByGithubRefs: [
        {
          owner: 'example-owner',
          repo: 'example-repo',
          number: 17,
          url: 'https://github.com/example-owner/example-repo/issues/17',
        },
      ],
    })
  })
})

describe('resolveSearchContext', () => {
  it('uses the default context when the query has no context token', () => {
    expect(resolveSearchContext('urgent', 'personal')).toBe('personal')
  })

  it('prefers an explicit context token over the default context', () => {
    expect(resolveSearchContext('urgent context:work', 'personal')).toBe('work')
  })

  it('leaves context unset when no default is provided', () => {
    expect(resolveSearchContext('urgent')).toBeUndefined()
  })
})

describe('extractCurrentPrefix', () => {
  it('returns the whole query when it is a single bare word', () => {
    expect(extractCurrentPrefix('is')).toBe('is')
  })

  it('returns the last word being typed', () => {
    expect(extractCurrentPrefix('context:work is')).toBe('is')
  })

  it('returns the token when it ends with a colon', () => {
    expect(extractCurrentPrefix('is:')).toBe('is:')
  })

  it('returns empty once the token is a complete key:value pair', () => {
    expect(extractCurrentPrefix('is:todo')).toBe('')
  })

  it('returns empty for an empty query', () => {
    expect(extractCurrentPrefix('')).toBe('')
  })
})

describe('applySuggestionToQuery', () => {
  it('replaces the last word being typed with the suggestion value', () => {
    expect(applySuggestionToQuery('sort:updated is', makeSuggestion())).toBe(
      'sort:updated is:todo ',
    )
  })

  it('replaces the sole token when the query is a single bare word', () => {
    expect(applySuggestionToQuery('is', makeSuggestion())).toBe('is:todo ')
  })
})
