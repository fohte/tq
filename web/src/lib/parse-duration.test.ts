import { describe, expect, it } from 'vitest'

import { parseDurationToMinutes } from '#lib/parse-duration'

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
    expect(parseDurationToMinutes('0m')).toBe(0)
  })

  it('parses zero hours', () => {
    expect(parseDurationToMinutes('0h')).toBe(0)
    expect(parseDurationToMinutes('0h0m')).toBe(0)
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
