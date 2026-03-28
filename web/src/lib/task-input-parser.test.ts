import {
  detectTrigger,
  getSuggestions,
  parseTaskInput,
} from '@web/lib/task-input-parser'
import { describe, expect, it } from 'vitest'

function formatLocalDate(d: Date): string {
  return `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

describe('parseTaskInput', () => {
  it('parses a plain title', () => {
    const result = parseTaskInput('Buy groceries')
    expect(result).toEqual({
      title: 'Buy groceries',
      labels: [],
    })
  })

  it('parses estimated minutes with @Nm', () => {
    const result = parseTaskInput('Task @30m')
    expect(result.title).toBe('Task')
    expect(result.estimatedMinutes).toBe(30)
  })

  it('parses estimated hours with @Nh', () => {
    const result = parseTaskInput('Task @1h')
    expect(result.title).toBe('Task')
    expect(result.estimatedMinutes).toBe(60)
  })

  it('parses estimated decimal hours with @N.Nh', () => {
    const result = parseTaskInput('Task @1.5h')
    expect(result.title).toBe('Task')
    expect(result.estimatedMinutes).toBe(90)
  })

  it('parses dueDate with @today', () => {
    const today = formatLocalDate(new Date())
    const result = parseTaskInput('Task @today')
    expect(result.title).toBe('Task')
    expect(result.dueDate).toBe(today)
  })

  it('parses dueDate with @tomorrow', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const expected = formatLocalDate(tomorrow)

    const result = parseTaskInput('Task @tomorrow')
    expect(result.title).toBe('Task')
    expect(result.dueDate).toBe(expected)
  })

  it('parses dueDate with @YYYY-MM-DD', () => {
    const result = parseTaskInput('Task @2026-03-25')
    expect(result.title).toBe('Task')
    expect(result.dueDate).toBe('2026-03-25')
  })

  it('parses startDate with >today', () => {
    const today = formatLocalDate(new Date())
    const result = parseTaskInput('Task >today')
    expect(result.title).toBe('Task')
    expect(result.startDate).toBe(today)
  })

  it('parses startDate with >tomorrow', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const expected = formatLocalDate(tomorrow)

    const result = parseTaskInput('Task >tomorrow')
    expect(result.title).toBe('Task')
    expect(result.startDate).toBe(expected)
  })

  it('parses startDate with >YYYY-MM-DD', () => {
    const result = parseTaskInput('Task >2026-04-01')
    expect(result.title).toBe('Task')
    expect(result.startDate).toBe('2026-04-01')
  })

  it('parses labels with #', () => {
    const result = parseTaskInput('Buy milk #groceries')
    expect(result.title).toBe('Buy milk')
    expect(result.labels).toEqual(['groceries'])
  })

  it('parses multiple labels', () => {
    const result = parseTaskInput('Task #urgent #work')
    expect(result.title).toBe('Task')
    expect(result.labels).toEqual(['urgent', 'work'])
  })

  it('parses context with %', () => {
    const result = parseTaskInput('Task %work')
    expect(result.title).toBe('Task')
    expect(result.context).toBe('work')
  })

  it('ignores invalid context values', () => {
    const result = parseTaskInput('Task %invalid')
    expect(result.title).toBe('Task %invalid')
    expect(result.context).toBeUndefined()
  })

  it('parses a complex input with all fields', () => {
    const today = formatLocalDate(new Date())
    const result = parseTaskInput(
      'Buy groceries @30m @tomorrow #food %personal >today',
    )
    expect(result.title).toBe('Buy groceries')
    expect(result.estimatedMinutes).toBe(30)
    expect(result.labels).toEqual(['food'])
    expect(result.context).toBe('personal')
    expect(result.startDate).toBe(today)

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    expect(result.dueDate).toBe(formatLocalDate(tomorrow))
  })

  it('handles empty input', () => {
    const result = parseTaskInput('')
    expect(result.title).toBe('')
    expect(result.labels).toEqual([])
  })

  it('treats standalone @ as title', () => {
    const result = parseTaskInput('Meet @ cafe')
    expect(result.title).toBe('Meet @ cafe')
  })

  it('treats standalone # as title', () => {
    const result = parseTaskInput('Issue # 42')
    expect(result.title).toBe('Issue # 42')
  })

  it('treats standalone > as title', () => {
    const result = parseTaskInput('2 > 1')
    expect(result.title).toBe('2 > 1')
  })

  it('last value wins for single-value fields', () => {
    const result = parseTaskInput('Task @30m @1h')
    expect(result.estimatedMinutes).toBe(60)
  })
})

describe('detectTrigger', () => {
  it('detects @ trigger at cursor', () => {
    const result = detectTrigger('Task @', 6)
    expect(result).toEqual({ trigger: '@', partial: '', tokenStart: 5 })
  })

  it('detects @ with partial text', () => {
    const result = detectTrigger('Task @to', 8)
    expect(result).toEqual({ trigger: '@', partial: 'to', tokenStart: 5 })
  })

  it('detects # trigger', () => {
    const result = detectTrigger('Task #foo', 9)
    expect(result).toEqual({ trigger: '#', partial: 'foo', tokenStart: 5 })
  })

  it('detects > trigger', () => {
    const result = detectTrigger('Task >', 6)
    expect(result).toEqual({ trigger: '>', partial: '', tokenStart: 5 })
  })

  it('detects % trigger', () => {
    const result = detectTrigger('Task %w', 7)
    expect(result).toEqual({ trigger: '%', partial: 'w', tokenStart: 5 })
  })

  it('returns null when not on a trigger token', () => {
    const result = detectTrigger('Task foo', 8)
    expect(result).toBeNull()
  })

  it('returns null for empty input', () => {
    const result = detectTrigger('', 0)
    expect(result).toBeNull()
  })
})

describe('getSuggestions', () => {
  it('returns all @ suggestions with empty partial', () => {
    const result = getSuggestions('@', '')
    expect(result).toHaveLength(6)
    expect(result.map((s) => s.value)).toEqual([
      'today',
      'tomorrow',
      '15m',
      '30m',
      '1h',
      '2h',
    ])
  })

  it('filters @ suggestions by partial', () => {
    const result = getSuggestions('@', 'to')
    expect(result.map((s) => s.value)).toEqual(['today', 'tomorrow'])
  })

  it('returns > suggestions', () => {
    const result = getSuggestions('>', '')
    expect(result.map((s) => s.value)).toEqual(['today', 'tomorrow'])
  })

  it('returns # suggestions from available labels', () => {
    const result = getSuggestions('#', '', ['food', 'work', 'fun'])
    expect(result.map((s) => s.value)).toEqual(['food', 'work', 'fun'])
  })

  it('filters # suggestions by partial', () => {
    const result = getSuggestions('#', 'fo', ['food', 'work', 'fun'])
    expect(result.map((s) => s.value)).toEqual(['food'])
  })

  it('returns % suggestions', () => {
    const result = getSuggestions('%', '')
    expect(result.map((s) => s.value)).toEqual(['work', 'personal', 'dev'])
  })

  it('filters % suggestions by partial', () => {
    const result = getSuggestions('%', 'w')
    expect(result.map((s) => s.value)).toEqual(['work'])
  })
})
