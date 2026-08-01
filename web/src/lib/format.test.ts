import { describe, expect, it } from 'vitest'

import { formatMinutes, formatRelativeTime } from '#lib/format'

describe('formatMinutes', () => {
  it('formats minutes under an hour', () => {
    expect(formatMinutes(30)).toBe('30m')
  })

  it('formats a single exact hour', () => {
    expect(formatMinutes(60)).toBe('1h')
  })

  it('formats multiple exact hours', () => {
    expect(formatMinutes(120)).toBe('2h')
  })

  it('formats a single hour with leftover minutes', () => {
    expect(formatMinutes(90)).toBe('1h30m')
  })

  it('formats multiple hours with leftover minutes', () => {
    expect(formatMinutes(135)).toBe('2h15m')
  })
})

describe('formatRelativeTime', () => {
  const now = new Date('2026-03-20T12:00:00.000Z')

  it('returns "just now" for under a minute', () => {
    expect(formatRelativeTime('2026-03-20T11:59:30.000Z', now)).toBe('just now')
  })

  it('formats minutes', () => {
    expect(formatRelativeTime('2026-03-20T11:55:00.000Z', now)).toBe('5m ago')
  })

  it('formats hours', () => {
    expect(formatRelativeTime('2026-03-20T09:00:00.000Z', now)).toBe('3h ago')
  })

  it('formats days', () => {
    expect(formatRelativeTime('2026-03-17T12:00:00.000Z', now)).toBe('3d ago')
  })

  it('falls back to a short date without a year for the same year', () => {
    expect(formatRelativeTime('2026-01-01T12:00:00.000Z', now)).toBe('Jan 1')
  })

  it('falls back to a short date with a year for a different year', () => {
    expect(formatRelativeTime('2025-01-01T12:00:00.000Z', now)).toBe(
      'Jan 1, 2025',
    )
  })
})
