import { describe, expect, it } from 'vitest'

import {
  formatAbsoluteReminder,
  formatReminderSummary,
  parseReminderInput,
} from '#lib/reminder-input'

describe('formatAbsoluteReminder', () => {
  it('formats a date with the Japanese weekday', () => {
    expect(formatAbsoluteReminder(new Date(2026, 8, 9, 9, 0))).toBe(
      '2026/09/09 (水) 09:00',
    )
  })
})

describe('formatReminderSummary', () => {
  const now = new Date(2026, 8, 8, 10, 0)

  it('labels a same-day reminder as "今日"', () => {
    expect(formatReminderSummary(new Date(2026, 8, 8, 18, 0), now)).toBe(
      '今日 18:00',
    )
  })

  it('labels a next-day reminder as "明日"', () => {
    expect(formatReminderSummary(new Date(2026, 8, 9, 9, 0), now)).toBe(
      '明日 09:00',
    )
  })

  it('falls back to the full absolute format further out', () => {
    expect(formatReminderSummary(new Date(2026, 8, 14, 9, 0), now)).toBe(
      '2026/09/14 (月) 09:00',
    )
  })
})

describe('parseReminderInput', () => {
  const now = new Date(2026, 8, 8, 10, 0)

  it('returns null for empty input', async () => {
    expect(await parseReminderInput('', now)).toBeNull()
  })

  it('returns null for unrecognized text', async () => {
    expect(await parseReminderInput('あいうえお', now)).toBeNull()
  })

  it('parses "N分後" as a relative duration', async () => {
    expect(await parseReminderInput('30分後', now)).toEqual(
      new Date(2026, 8, 8, 10, 30),
    )
  })

  it('returns null for a relative duration large enough to overflow Date', async () => {
    expect(await parseReminderInput('99999999999時間後', now)).toBeNull()
  })

  it('parses "N時間後" as a relative duration', async () => {
    expect(await parseReminderInput('1時間後', now)).toEqual(
      new Date(2026, 8, 8, 11, 0),
    )
  })

  it('parses a Japanese natural-language date via chrono-node', async () => {
    expect(await parseReminderInput('明日9時', now)).toEqual(
      new Date(2026, 8, 9, 9, 0),
    )
  })

  it('parses a specific date and time', async () => {
    expect(await parseReminderInput('2026年9月12日 9時', now)).toEqual(
      new Date(2026, 8, 12, 9, 0),
    )
  })

  it('rolls an already-passed time forward to the next occurrence', async () => {
    // `now` is 10:00, so a bare "9時" would be in the past without
    // forwardDate — a reminder must never resolve to a past instant.
    expect(await parseReminderInput('9時', now)).toEqual(
      new Date(2026, 8, 9, 9, 0),
    )
  })
})
