import { describe, expect, it } from 'vitest'

import { formatRelativeTime } from '#lib/format'

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
