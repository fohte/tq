import { describe, expect, it } from 'vitest'

import {
  classifyGcalEvent,
  isGcalEventType,
  isPendingGcalResponse,
} from '#lib/calendar-utils'

describe('classifyGcalEvent', () => {
  it('classifies a default event with other attendees as a meeting', () => {
    expect(
      classifyGcalEvent({
        eventType: 'default',
        hasOtherAttendees: true,
        isAllDay: false,
      }),
    ).toBe('gcal-meeting')
  })

  it('classifies a default event with no other attendees as solo', () => {
    expect(
      classifyGcalEvent({
        eventType: 'default',
        hasOtherAttendees: false,
        isAllDay: false,
      }),
    ).toBe('gcal-solo')
  })

  it('classifies outOfOffice as a status event regardless of attendees', () => {
    expect(
      classifyGcalEvent({
        eventType: 'outOfOffice',
        hasOtherAttendees: true,
        isAllDay: false,
      }),
    ).toBe('gcal-status')
  })

  it('classifies focusTime as a status event', () => {
    expect(
      classifyGcalEvent({
        eventType: 'focusTime',
        hasOtherAttendees: false,
        isAllDay: false,
      }),
    ).toBe('gcal-status')
  })

  it('classifies workingLocation as info even when timed', () => {
    expect(
      classifyGcalEvent({
        eventType: 'workingLocation',
        hasOtherAttendees: false,
        isAllDay: false,
      }),
    ).toBe('gcal-info')
  })

  it('classifies any all-day event as info, overriding eventType', () => {
    expect(
      classifyGcalEvent({
        eventType: 'focusTime',
        hasOtherAttendees: false,
        isAllDay: true,
      }),
    ).toBe('gcal-info')
  })

  it('falls back to the meeting/solo split for an eventType Google adds later', () => {
    expect(
      classifyGcalEvent({
        eventType: 'someFutureType',
        hasOtherAttendees: true,
        isAllDay: false,
      }),
    ).toBe('gcal-meeting')
  })
})

describe('isGcalEventType', () => {
  it('is true for every gcal-derived type', () => {
    expect(
      (['gcal-meeting', 'gcal-solo', 'gcal-status', 'gcal-info'] as const).map(
        isGcalEventType,
      ),
    ).toEqual([true, true, true, true])
  })

  it('is false for non-gcal types and undefined', () => {
    expect(
      (['manual', 'auto', 'completed', 'schedule', undefined] as const).map(
        isGcalEventType,
      ),
    ).toEqual([false, false, false, false, false])
  })
})

describe('isPendingGcalResponse', () => {
  it('dims a gcal event with a needsAction response', () => {
    expect(
      isPendingGcalResponse({
        type: 'gcal-meeting',
        responseStatus: 'needsAction',
      }),
    ).toBe(true)
  })

  it('dims a gcal event with a tentative response', () => {
    expect(
      isPendingGcalResponse({
        type: 'gcal-solo',
        responseStatus: 'tentative',
      }),
    ).toBe(true)
  })

  it('does not dim a gcal event with an accepted response', () => {
    expect(
      isPendingGcalResponse({
        type: 'gcal-status',
        responseStatus: 'accepted',
      }),
    ).toBe(false)
  })

  it('does not dim a non-gcal event even with a needsAction response', () => {
    expect(
      isPendingGcalResponse({
        type: 'manual',
        responseStatus: 'needsAction',
      }),
    ).toBe(false)
  })
})
