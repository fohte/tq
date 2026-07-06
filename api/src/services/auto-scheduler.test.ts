import { autoAssign, calculateFreeSlots } from '@api/services/auto-scheduler'
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

  it('merges overlapping and adjacent busy ranges', () => {
    const slots = calculateFreeSlots(d('09:00'), d('18:00'), [
      { start: d('10:00'), end: d('11:30') },
      { start: d('11:00'), end: d('12:00') }, // overlaps the previous
      { start: d('12:00'), end: d('12:30') }, // adjacent to the merged range
    ])

    expect(slots).toEqual([
      { startTime: d('09:00'), endTime: d('10:00'), durationMinutes: 60 },
      { startTime: d('12:30'), endTime: d('18:00'), durationMinutes: 330 },
    ])
  })

  it('clips busy ranges that extend outside the day bounds', () => {
    const slots = calculateFreeSlots(d('09:00'), d('18:00'), [
      { start: d('07:00'), end: d('10:00') }, // starts before dayStart
      { start: d('17:00'), end: d('20:00') }, // ends after dayEnd
    ])

    expect(slots).toEqual([
      { startTime: d('10:00'), endTime: d('17:00'), durationMinutes: 420 },
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
    const freeSlots = calculateFreeSlots(d('09:00'), d('12:00'), [])

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
    const freeSlots = calculateFreeSlots(d('09:00'), d('18:00'), [
      { start: d('09:30'), end: d('13:00') },
    ])

    const blocks = autoAssign(
      [
        { taskId: 'a', estimatedMinutes: 20 }, // fits in 09:00-09:30
        { taskId: 'b', estimatedMinutes: 60 }, // doesn't fit remaining 10min, moves to next slot
      ],
      freeSlots,
    )

    expect(blocks).toEqual([
      { taskId: 'a', startTime: d('09:00'), endTime: d('09:20') },
      { taskId: 'b', startTime: d('13:00'), endTime: d('14:00') },
    ])
  })

  it('leaves remaining tasks unassigned once slots are exhausted', () => {
    const freeSlots = calculateFreeSlots(d('09:00'), d('10:00'), [])

    const blocks = autoAssign(
      [
        { taskId: 'a', estimatedMinutes: 45 },
        { taskId: 'b', estimatedMinutes: 30 }, // doesn't fit remaining 15min, no more slots
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
