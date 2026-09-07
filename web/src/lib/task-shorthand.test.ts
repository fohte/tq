import { describe, expect, it } from 'vitest'

import { formatLocalDate } from '#lib/date-range'
import { extractShorthandTokens } from '#lib/task-shorthand'

function tomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return formatLocalDate(d)
}

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
    const today = formatLocalDate(new Date())
    expect(extractShorthandTokens('Task @today ')).toEqual({
      title: 'Task ',
      dueDate: today,
      labels: [],
    })
  })

  it('parses dueDate with @tomorrow', () => {
    expect(extractShorthandTokens('Task @tomorrow ')).toEqual({
      title: 'Task ',
      dueDate: tomorrow(),
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
    const today = formatLocalDate(new Date())
    expect(extractShorthandTokens('Task >today ')).toEqual({
      title: 'Task ',
      startDate: today,
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

  it('parses a complex input with all fields at once', () => {
    const today = formatLocalDate(new Date())
    expect(
      extractShorthandTokens(
        'Buy groceries @30m @tomorrow #food %personal >today ',
      ),
    ).toEqual({
      title: 'Buy groceries ',
      estimateInput: '30m',
      dueDate: tomorrow(),
      startDate: today,
      context: 'personal',
      labels: ['food'],
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
