import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  detectTrigger,
  extractShorthandTokens,
  getSuggestions,
} from '#lib/task-shorthand'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('extractShorthandTokens', () => {
  it('leaves plain text untouched', () => {
    expect(extractShorthandTokens('Buy groceries')).toEqual({
      title: 'Buy groceries',
      labels: [],
    })
  })

  it('leaves the in-progress trailing token untouched', () => {
    expect(extractShorthandTokens('Task @30m')).toEqual({
      title: 'Task @30m',
      labels: [],
    })
  })

  it('consumes a completed duration token once followed by a space', () => {
    expect(extractShorthandTokens('Task @30m ')).toEqual({
      title: 'Task ',
      estimateInput: '30m',
      labels: [],
    })
  })

  it('keeps the raw duration string rather than converting to minutes', () => {
    expect(extractShorthandTokens('Task @1h30m ')).toEqual({
      title: 'Task ',
      estimateInput: '1h30m',
      labels: [],
    })
  })

  it('consumes a completed token as soon as another word follows it', () => {
    expect(extractShorthandTokens('Task @30m more')).toEqual({
      title: 'Task more',
      estimateInput: '30m',
      labels: [],
    })
  })

  it('parses dueDate with @today', () => {
    expect(extractShorthandTokens('Task @today ')).toEqual({
      title: 'Task ',
      dueDate: '2026-01-01',
      labels: [],
    })
  })

  it('parses dueDate with @tomorrow', () => {
    expect(extractShorthandTokens('Task @tomorrow ')).toEqual({
      title: 'Task ',
      dueDate: '2026-01-02',
      labels: [],
    })
  })

  it('parses dueDate with @YYYY-MM-DD', () => {
    expect(extractShorthandTokens('Task @2026-03-25 ')).toEqual({
      title: 'Task ',
      dueDate: '2026-03-25',
      labels: [],
    })
  })

  it('parses startDate with >today', () => {
    expect(extractShorthandTokens('Task >today ')).toEqual({
      title: 'Task ',
      startDate: '2026-01-01',
      labels: [],
    })
  })

  it('parses startDate with >YYYY-MM-DD', () => {
    expect(extractShorthandTokens('Task >2026-04-01 ')).toEqual({
      title: 'Task ',
      startDate: '2026-04-01',
      labels: [],
    })
  })

  it('leaves unrecognized > tokens as title text', () => {
    expect(extractShorthandTokens('2 > 1 ')).toEqual({
      title: '2 > 1 ',
      labels: [],
    })
  })

  it('parses a single label with #', () => {
    expect(extractShorthandTokens('Buy milk #groceries ')).toEqual({
      title: 'Buy milk ',
      labels: ['groceries'],
    })
  })

  it('parses multiple labels', () => {
    expect(extractShorthandTokens('Task #urgent #work ')).toEqual({
      title: 'Task ',
      labels: ['urgent', 'work'],
    })
  })

  it('parses context with %', () => {
    expect(extractShorthandTokens('Task %work ')).toEqual({
      title: 'Task ',
      context: 'work',
      labels: [],
    })
  })

  it('leaves invalid context values as title text', () => {
    expect(extractShorthandTokens('Task %invalid ')).toEqual({
      title: 'Task %invalid ',
      labels: [],
    })
  })

  it('parses a parent task number with ^', () => {
    expect(extractShorthandTokens('Fix bug ^42 ')).toEqual({
      title: 'Fix bug ',
      parentNumber: 42,
      labels: [],
    })
  })

  it('leaves non-numeric ^ tokens as title text', () => {
    expect(extractShorthandTokens('Task ^abc ')).toEqual({
      title: 'Task ^abc ',
      labels: [],
    })
  })

  it('parses a GitHub issue URL once followed by a space', () => {
    expect(
      extractShorthandTokens('Fix bug https://github.com/fohte/tq/issues/123 '),
    ).toEqual({
      title: 'Fix bug ',
      githubUrl: 'https://github.com/fohte/tq/issues/123',
      labels: [],
    })
  })

  it('parses a GitHub pull request URL', () => {
    expect(
      extractShorthandTokens('https://github.com/fohte/tq/pull/45 '),
    ).toEqual({
      title: '',
      githubUrl: 'https://github.com/fohte/tq/pull/45',
      labels: [],
    })
  })

  it('drops a trailing comment fragment from a GitHub issue URL', () => {
    expect(
      extractShorthandTokens(
        'Fix bug https://github.com/fohte/tq/issues/123#issuecomment-1 ',
      ),
    ).toEqual({
      title: 'Fix bug ',
      githubUrl: 'https://github.com/fohte/tq/issues/123',
      labels: [],
    })
  })

  it('leaves the in-progress GitHub URL token untouched', () => {
    expect(
      extractShorthandTokens('https://github.com/fohte/tq/issues/123'),
    ).toEqual({
      title: 'https://github.com/fohte/tq/issues/123',
      labels: [],
    })
  })

  it('leaves a non-GitHub URL as title text', () => {
    expect(extractShorthandTokens('https://example.com/issues/1 ')).toEqual({
      title: 'https://example.com/issues/1 ',
      labels: [],
    })
  })

  it('parses a complex input with all fields at once', () => {
    expect(
      extractShorthandTokens(
        'Buy groceries @30m @tomorrow #food %personal >today ^42 ',
      ),
    ).toEqual({
      title: 'Buy groceries ',
      estimateInput: '30m',
      dueDate: '2026-01-02',
      startDate: '2026-01-01',
      context: 'personal',
      labels: ['food'],
      parentNumber: 42,
    })
  })

  it('treats standalone trigger characters as title text', () => {
    expect(extractShorthandTokens('Meet @ cafe #  ')).toEqual({
      title: 'Meet @ cafe #  ',
      labels: [],
    })
  })

  it('handles empty input', () => {
    expect(extractShorthandTokens('')).toEqual({
      title: '',
      labels: [],
    })
  })
})

describe('detectTrigger', () => {
  it('detects a trigger at the end of the input', () => {
    expect(detectTrigger('Task @30', 8)).toEqual({
      trigger: '@',
      partial: '30',
      tokenStart: 5,
    })
  })

  it('detects a trigger with the cursor mid-token', () => {
    expect(detectTrigger('Task @30m more', 7)).toEqual({
      trigger: '@',
      partial: '3',
      tokenStart: 5,
    })
  })

  it('returns null when the trigger char is not at the start of the token', () => {
    expect(detectTrigger('a@b', 3)).toBeNull()
  })

  it('detects the ^ parent trigger', () => {
    expect(detectTrigger('Task ^4', 7)).toEqual({
      trigger: '^',
      partial: '4',
      tokenStart: 5,
    })
  })

  it('returns null when no trigger token is present', () => {
    expect(detectTrigger('Task title', 10)).toBeNull()
  })

  it('returns null right after a completed token followed by a space', () => {
    expect(detectTrigger('Task @30m ', 10)).toBeNull()
  })
})

describe('getSuggestions', () => {
  it('returns all items for an empty partial', () => {
    expect(getSuggestions('%', '')).toEqual([
      { value: 'work', display: 'work' },
      { value: 'personal', display: 'personal' },
    ])
  })

  it('filters items by a case-insensitive prefix match', () => {
    expect(getSuggestions('@', 'TOM')).toEqual([
      { value: 'tomorrow', display: 'tomorrow' },
    ])
  })

  it('returns no labels for # when none are available', () => {
    expect(getSuggestions('#', '')).toEqual([])
  })

  it('maps available labels to suggestions for #', () => {
    expect(getSuggestions('#', '', ['urgent', 'chore'])).toEqual([
      { value: 'urgent', display: 'urgent' },
      { value: 'chore', display: 'chore' },
    ])
  })

  it('excludes multi-word labels for # since the syntax has no quoting', () => {
    expect(getSuggestions('#', '', ['urgent', 'urgent task'])).toEqual([
      { value: 'urgent', display: 'urgent' },
    ])
  })

  it('returns no items for ^ since its suggestions are fetched asynchronously', () => {
    expect(getSuggestions('^', '')).toEqual([])
  })
})
