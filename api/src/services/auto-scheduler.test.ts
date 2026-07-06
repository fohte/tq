import {
  autoAssign,
  calculateFreeSlots,
  expandedScheduleBlocksToBusyRanges,
  externalEventsToBusyRanges,
  manualBlocksToBusyRanges,
} from '@api/services/auto-scheduler'
import { describe, expect, it } from 'vitest'

function d(hhmm: string): Date {
  return new Date(`2026-03-22T${hhmm}:00.000Z`)
}

describe('calculateFreeSlots', () => {
  it('returns the whole day as one slot when there are no busy ranges', () => {
    const slots = calculateFreeSlots(d('00:00'), d('24:00'), [])

    expect(slots).toEqual([
      { startTime: d('00:00'), endTime: d('24:00'), durationMinutes: 1440 },
    ])
  })

  it('splits into two slots around a single busy range', () => {
    const slots = calculateFreeSlots(d('09:00'), d('18:00'), [
      { start: d('12:00'), end: d('13:00') },
    ])

    expect(slots).toEqual([
      { startTime: d('09:00'), endTime: d('12:00'), durationMinutes: 180 },
      { startTime: d('13:00'), endTime: d('18:00'), durationMinutes: 300 },
    ])
  })

  it('merges overlapping busy ranges', () => {
    const slots = calculateFreeSlots(d('09:00'), d('18:00'), [
      { start: d('10:00'), end: d('11:30') },
      { start: d('11:00'), end: d('12:00') },
    ])

    expect(slots).toEqual([
      { startTime: d('09:00'), endTime: d('10:00'), durationMinutes: 60 },
      { startTime: d('12:00'), endTime: d('18:00'), durationMinutes: 360 },
    ])
  })

  it('merges adjacent busy ranges', () => {
    const slots = calculateFreeSlots(d('09:00'), d('18:00'), [
      { start: d('10:00'), end: d('11:00') },
      { start: d('11:00'), end: d('12:00') },
    ])

    expect(slots).toEqual([
      { startTime: d('09:00'), endTime: d('10:00'), durationMinutes: 60 },
      { startTime: d('12:00'), endTime: d('18:00'), durationMinutes: 360 },
    ])
  })

  it('clips a busy range that starts before the day bounds', () => {
    const slots = calculateFreeSlots(d('09:00'), d('18:00'), [
      { start: d('07:00'), end: d('10:00') },
    ])

    expect(slots).toEqual([
      { startTime: d('10:00'), endTime: d('18:00'), durationMinutes: 480 },
    ])
  })

  it('clips a busy range that ends after the day bounds', () => {
    const slots = calculateFreeSlots(d('09:00'), d('18:00'), [
      { start: d('17:00'), end: d('20:00') },
    ])

    expect(slots).toEqual([
      { startTime: d('09:00'), endTime: d('17:00'), durationMinutes: 480 },
    ])
  })

  it('ignores a busy range entirely outside the day bounds', () => {
    const slots = calculateFreeSlots(d('09:00'), d('18:00'), [
      { start: d('01:00'), end: d('02:00') },
    ])

    expect(slots).toEqual([
      { startTime: d('09:00'), endTime: d('18:00'), durationMinutes: 540 },
    ])
  })

  it('returns no slots when a busy range covers the entire day', () => {
    const slots = calculateFreeSlots(d('09:00'), d('18:00'), [
      { start: d('00:00'), end: d('24:00') },
    ])

    expect(slots).toEqual([])
  })
})

describe('autoAssign', () => {
  it('packs tasks back-to-back in queue order within a single slot', () => {
    const freeSlots = [
      { startTime: d('09:00'), endTime: d('12:00'), durationMinutes: 180 },
    ]

    const blocks = autoAssign(
      [
        { taskId: 'a', estimatedMinutes: 30 },
        { taskId: 'b', estimatedMinutes: 60 },
      ],
      freeSlots,
    )

    expect(blocks).toEqual([
      { taskId: 'a', startTime: d('09:00'), endTime: d('09:30') },
      { taskId: 'b', startTime: d('09:30'), endTime: d('10:30') },
    ])
  })

  it('moves to the next slot when a task does not fit the remaining room', () => {
    // Task "a" (20min) fits in the first slot's 30min; task "b" (60min)
    // doesn't fit the remaining 10min, so it moves to the second slot.
    const freeSlots = [
      { startTime: d('09:00'), endTime: d('09:30'), durationMinutes: 30 },
      { startTime: d('13:00'), endTime: d('18:00'), durationMinutes: 300 },
    ]

    const blocks = autoAssign(
      [
        { taskId: 'a', estimatedMinutes: 20 },
        { taskId: 'b', estimatedMinutes: 60 },
      ],
      freeSlots,
    )

    expect(blocks).toEqual([
      { taskId: 'a', startTime: d('09:00'), endTime: d('09:20') },
      { taskId: 'b', startTime: d('13:00'), endTime: d('14:00') },
    ])
  })

  it('leaves remaining tasks unassigned once slots are exhausted', () => {
    // Task "a" (45min) fills the only slot; task "b" (30min) doesn't fit
    // the remaining 15min and there are no more slots, so it and every
    // task after it (task "c") are left unassigned.
    const freeSlots = [
      { startTime: d('09:00'), endTime: d('10:00'), durationMinutes: 60 },
    ]

    const blocks = autoAssign(
      [
        { taskId: 'a', estimatedMinutes: 45 },
        { taskId: 'b', estimatedMinutes: 30 },
        { taskId: 'c', estimatedMinutes: 10 },
      ],
      freeSlots,
    )

    expect(blocks).toEqual([
      { taskId: 'a', startTime: d('09:00'), endTime: d('09:45') },
    ])
  })

  it('assigns nothing when there are no free slots', () => {
    const blocks = autoAssign([{ taskId: 'a', estimatedMinutes: 30 }], [])

    expect(blocks).toEqual([])
  })
})

describe('externalEventsToBusyRanges', () => {
  it('converts timed events to busy ranges', () => {
    const ranges = externalEventsToBusyRanges([
      {
        startTime: '2026-03-22T09:00:00.000Z',
        endTime: '2026-03-22T10:00:00.000Z',
        isAllDay: false,
      },
    ])

    expect(ranges).toEqual([{ start: d('09:00'), end: d('10:00') }])
  })

  it('excludes all-day events', () => {
    const ranges = externalEventsToBusyRanges([
      { startTime: '2026-03-22', endTime: '2026-03-23', isAllDay: true },
      {
        startTime: '2026-03-22T09:00:00.000Z',
        endTime: '2026-03-22T10:00:00.000Z',
        isAllDay: false,
      },
    ])

    expect(ranges).toEqual([{ start: d('09:00'), end: d('10:00') }])
  })
})

describe('manualBlocksToBusyRanges', () => {
  it('converts blocks with a known end time', () => {
    const ranges = manualBlocksToBusyRanges(
      [{ startTime: d('09:00'), endTime: d('10:00') }],
      d('18:00'),
    )

    expect(ranges).toEqual([{ start: d('09:00'), end: d('10:00') }])
  })

  it('falls back to the given end for in-progress blocks (null endTime)', () => {
    const ranges = manualBlocksToBusyRanges(
      [{ startTime: d('09:00'), endTime: null }],
      d('18:00'),
    )

    expect(ranges).toEqual([{ start: d('09:00'), end: d('18:00') }])
  })
})

describe('expandedScheduleBlocksToBusyRanges', () => {
  it('converts naive local datetime strings to UTC using the given offset', () => {
    // tzOffset -540 = JST (UTC+9): 09:00 local -> 00:00 UTC
    const ranges = expandedScheduleBlocksToBusyRanges(
      [{ start: '2026-03-22T09:00:00', end: '2026-03-22T10:00:00' }],
      -540,
    )

    expect(ranges).toEqual([{ start: d('00:00'), end: d('01:00') }])
  })
})
