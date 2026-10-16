import { describe, expect, it } from 'vitest'

import {
  addCalendarDays,
  formatDateInTimeZone,
  localDateTimeToUtc,
} from '#lib/timezone'

function scheduleDateTimeSnapshot() {
  return {
    date: formatDateInTimeZone(
      new Date('2026-12-17T12:00:00.000Z'),
      'Asia/Tokyo',
    ),
    instant: localDateTimeToUtc('2026-12-17', '14:30', 'Asia/Tokyo'),
  }
}

describe('time zone conversion', () => {
  it('converts local schedule date and time using the configured time zone', () => {
    expect(scheduleDateTimeSnapshot()).toEqual({
      date: '2026-12-17',
      instant: new Date('2026-12-17T05:30:00.000Z'),
    })
  })

  it('adds calendar days across a year boundary', () => {
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})
