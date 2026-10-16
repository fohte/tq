import { describe, expect, it } from 'vitest'

import type { ScheduleSeries } from '#routes/schedule-expansion'
import { collectDueScheduleReminders } from '#services/schedule-reminder-candidates'

const FIXED_TIMESTAMP = new Date('2026-01-01T00:00:00.000Z')

function makeScheduleSeries(
  remindBeforeMinutes: number | null,
  effectiveFrom = '2026-12-17',
): ScheduleSeries {
  const scheduleId = 'schedule-id'

  return {
    schedule: {
      id: scheduleId,
      title: 'Planning session',
      endDate: null,
      remindBeforeMinutes,
      context: 'personal',
      color: null,
      createdAt: FIXED_TIMESTAMP,
      updatedAt: FIXED_TIMESTAMP,
    },
    revisions: [
      {
        revision: {
          scheduleId,
          effectiveFrom,
          startTime: '14:30',
          endTime: '15:30',
          recurrenceRuleId: null,
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
        rule: null,
      },
    ],
  }
}

function collect(series: ScheduleSeries, date: string, now: string) {
  return collectDueScheduleReminders(
    [series],
    new Map(),
    [date],
    new Date(now),
    'Asia/Tokyo',
  )
}

describe('collectDueScheduleReminders', () => {
  it('excludes a reminder that is still in the future', () => {
    expect(
      collect(makeScheduleSeries(45), '2026-12-17', '2026-12-17T04:44:59.999Z'),
    ).toEqual([])
  })

  it('excludes a reminder that is more than one hour late', () => {
    expect(
      collect(
        makeScheduleSeries(1440, '2026-12-18'),
        '2026-12-18',
        '2026-12-17T06:31:00.000Z',
      ),
    ).toEqual([])
  })

  it('excludes an occurrence that has already started', () => {
    expect(
      collect(makeScheduleSeries(45), '2026-12-17', '2026-12-17T05:31:00.000Z'),
    ).toEqual([])
  })

  it('keeps a zero-minute reminder during the scheduler grace period', () => {
    expect(
      collect(makeScheduleSeries(0), '2026-12-17', '2026-12-17T05:30:30.000Z'),
    ).toEqual([
      {
        scheduleId: 'schedule-id',
        occurrenceDate: '2026-12-17',
        remindAt: new Date('2026-12-17T05:30:00.000Z'),
        startsAt: new Date('2026-12-17T05:30:00.000Z'),
        title: 'Planning session',
        context: 'personal',
      },
    ])
  })
})
