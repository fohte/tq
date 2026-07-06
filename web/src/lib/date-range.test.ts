import { getDayIsoRange } from '@web/lib/date-range'
import { describe, expect, it } from 'vitest'

// Reads the ISO string back into local-time fields, independently of
// getDayIsoRange's own construction formula and of the machine's timezone.
function toLocalFields(iso: string) {
  const d = new Date(iso)
  return {
    year: d.getFullYear(),
    month: d.getMonth(),
    date: d.getDate(),
    hours: d.getHours(),
    minutes: d.getMinutes(),
    seconds: d.getSeconds(),
    ms: d.getMilliseconds(),
  }
}

describe('getDayIsoRange', () => {
  it('returns the UTC ISO range for local midnight to midnight of the given date', () => {
    const { timeMin, timeMax } = getDayIsoRange('2026-07-07')

    expect(toLocalFields(timeMin)).toEqual({
      year: 2026,
      month: 6,
      date: 7,
      hours: 0,
      minutes: 0,
      seconds: 0,
      ms: 0,
    })
    expect(toLocalFields(timeMax)).toEqual({
      year: 2026,
      month: 6,
      date: 8,
      hours: 0,
      minutes: 0,
      seconds: 0,
      ms: 0,
    })
  })

  it('handles month boundaries', () => {
    const { timeMin, timeMax } = getDayIsoRange('2026-07-31')

    expect(toLocalFields(timeMin)).toEqual({
      year: 2026,
      month: 6,
      date: 31,
      hours: 0,
      minutes: 0,
      seconds: 0,
      ms: 0,
    })
    expect(toLocalFields(timeMax)).toEqual({
      year: 2026,
      month: 7,
      date: 1,
      hours: 0,
      minutes: 0,
      seconds: 0,
      ms: 0,
    })
  })
})
