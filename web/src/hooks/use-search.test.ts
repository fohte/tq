import { describe, expect, it } from 'vitest'

import { makeSuggestion } from '#components/search/search-test-fixtures'
import {
  makeTask,
  makeTaskDetail,
} from '#components/task/task-row-test-fixtures'
import {
  applySuggestionToQuery,
  extractCurrentPrefix,
  extractTaskNumber,
  resolveSearchContext,
  taskDetailToSearchResult,
} from '#hooks/use-search'

describe('extractTaskNumber', () => {
  it('accepts a bare number', () => {
    expect(extractTaskNumber('5')).toBe('5')
  })

  it('accepts a hash-prefixed number', () => {
    expect(extractTaskNumber('#5')).toBe('5')
  })

  it('rejects a non-numeric hash token', () => {
    expect(extractTaskNumber('#task')).toBeUndefined()
  })

  it('rejects a number followed by other text', () => {
    expect(extractTaskNumber('5 task')).toBeUndefined()
  })

  it('rejects an empty query', () => {
    expect(extractTaskNumber('')).toBeUndefined()
  })
})

describe('taskDetailToSearchResult', () => {
  it('maps detail relation fields to the list result shape', () => {
    const task = makeTaskDetail({
      duplicateOfNumber: null,
      blockedBy: [makeTask({ number: 12 }), makeTask({ number: 18 })],
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
      estimatedMinutes: task.estimatedMinutes,
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
      duplicateOfNumber: null,
      blockedByNumbers: [12, 18],
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
