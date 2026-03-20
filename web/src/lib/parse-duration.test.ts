import { formatMinutes, parseDurationToMinutes } from '@web/lib/parse-duration'
import { describe, expect, it } from 'vitest'

describe('parseDurationToMinutes', () => {
  it('parses plain minutes', () => {
    expect(parseDurationToMinutes('30')).toBe(30)
    expect(parseDurationToMinutes('90')).toBe(90)
  })

  it('parses hours', () => {
    expect(parseDurationToMinutes('1h')).toBe(60)
    expect(parseDurationToMinutes('2h')).toBe(120)
  })

  it('parses hours and minutes', () => {
    expect(parseDurationToMinutes('1h30m')).toBe(90)
    expect(parseDurationToMinutes('2h15m')).toBe(135)
  })

  it('parses minutes only with suffix', () => {
    expect(parseDurationToMinutes('45m')).toBe(45)
  })

  it('parses decimal hours', () => {
    expect(parseDurationToMinutes('1.5h')).toBe(90)
    expect(parseDurationToMinutes('0.5h')).toBe(30)
  })

  it('returns null for empty or invalid input', () => {
    expect(parseDurationToMinutes('')).toBeNull()
    expect(parseDurationToMinutes('abc')).toBeNull()
    expect(parseDurationToMinutes('h')).toBeNull()
  })
})

describe('formatMinutes', () => {
  it('formats minutes under an hour', () => {
    expect(formatMinutes(30)).toBe('30m')
  })

  it('formats exact hours', () => {
    expect(formatMinutes(60)).toBe('1h')
    expect(formatMinutes(120)).toBe('2h')
  })

  it('formats hours and minutes', () => {
    expect(formatMinutes(90)).toBe('1h30m')
    expect(formatMinutes(135)).toBe('2h15m')
  })
})
