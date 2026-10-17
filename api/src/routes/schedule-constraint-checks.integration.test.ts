import { afterEach, describe, expect, it, vi } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import { scheduleConstraints, scheduleConstraintWeekdays } from '#db/schema'
import { upsertGoogleCalendarToken } from '#integrations/google-calendar/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

const GOOGLE_ENV = {
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  GOOGLE_REDIRECT_URI: 'http://localhost:3001/api/calendar/oauth-callback',
}

type ScheduleResponse = {
  id: string
  title: string
  startDate: string
  endDate: string | null
  remindBeforeMinutes: number | null
  startTime: string
  endTime: string
  recurrence: {
    id: string
    type: string
    interval: number
    daysOfWeek: number[] | null
    dayOfMonth: number | null
  } | null
  context: string
  color: string | null
  constraintViolations: unknown[]
  createdAt: string
  updatedAt: string
}

async function createSchedule(body: Record<string, unknown>) {
  const response = await app.request('/api/schedule/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return jsonBody<ScheduleResponse>(response)
}

async function constraintCheckSnapshot(response: Response) {
  return { status: response.status, body: await jsonBody(response) }
}

async function scheduleResponseSnapshot(response: Response) {
  const body = await jsonBody<ScheduleResponse>(response)
  return {
    status: response.status,
    body: {
      ...body,
      id: 'SCHEDULE_ID',
      recurrence: body.recurrence
        ? { ...body.recurrence, id: 'RECURRENCE_ID' }
        : null,
      createdAt: 'TIMESTAMP',
      updatedAt: 'TIMESTAMP',
    },
  }
}

async function overrideResponseSnapshot(response: Response) {
  const body = await jsonBody<{
    scheduleId: string
    occurrenceDate: string
    startTime: string | null
    endTime: string | null
    movedToDate: string | null
    skipped: boolean
    constraintViolations: unknown[]
  }>(response)
  return {
    status: response.status,
    body: { ...body, scheduleId: 'SCHEDULE_ID' },
  }
}

async function addScheduleConstraint(
  scheduleId: string,
  weekdays: Array<{ dayOfWeek: number; preference: string }>,
) {
  await db.insert(scheduleConstraints).values({ scheduleId })
  if (weekdays.length === 0) return
  await db
    .insert(scheduleConstraintWeekdays)
    .values(weekdays.map((weekday) => ({ scheduleId, ...weekday })))
}

function emptyConstraint(
  weekdays: Array<{
    dayOfWeek: number
    preference: 'preferred' | 'if_free' | 'reserve' | 'excluded'
  }>,
) {
  return {
    weeklyMin: null,
    weeklyMax: null,
    weeklyTarget: null,
    maxConsecutiveDays: null,
    windowStart: null,
    windowEnd: null,
    weekdays,
  }
}

function setGoogleEnv() {
  for (const [key, value] of Object.entries(GOOGLE_ENV)) {
    process.env[key] = value
  }
}

afterEach(() => {
  for (const key of Object.keys(GOOGLE_ENV)) {
    Reflect.deleteProperty(process.env, key)
  }
  vi.restoreAllMocks()
})

describe('POST /api/schedule/events/:id/constraint-check', () => {
  it('checks a moved occurrence against draft constraints', async () => {
    const schedule = await createSchedule({
      title: 'Routine',
      startDate: '2030-05-09',
      startTime: '18:00',
      endTime: '19:00',
      recurrence: { type: 'weekly', interval: 1, daysOfWeek: [4] },
    })
    const response = await app.request(
      `/api/schedule/events/${schedule.id}/constraint-check`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: '2030-05-06',
          endDate: '2030-05-12',
          draft: {
            constraints: emptyConstraint([
              { dayOfWeek: 5, preference: 'excluded' },
            ]),
            occurrenceChange: {
              originalDate: '2030-05-09',
              date: '2030-05-10',
            },
          },
        }),
      },
    )

    expect(await constraintCheckSnapshot(response)).toEqual({
      status: 200,
      body: {
        constraintViolations: [
          {
            type: 'excluded-weekday',
            severity: 'required',
            date: '2030-05-10',
            originalDate: '2030-05-09',
          },
        ],
      },
    })
  })

  it('checks an if-free occurrence against another tq schedule', async () => {
    const target = await createSchedule({
      title: 'Routine',
      startDate: '2030-05-07',
      startTime: '18:00',
      endTime: '19:00',
    })
    await createSchedule({
      title: 'Other event',
      startDate: '2030-05-07',
      startTime: '18:30',
      endTime: '19:30',
    })
    const response = await app.request(
      `/api/schedule/events/${target.id}/constraint-check`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: '2030-05-06',
          endDate: '2030-05-12',
          draft: {
            constraints: emptyConstraint([
              { dayOfWeek: 2, preference: 'if_free' },
            ]),
          },
        }),
      },
    )

    expect(await constraintCheckSnapshot(response)).toEqual({
      status: 200,
      body: {
        constraintViolations: [
          {
            type: 'if-free-overlap',
            severity: 'required',
            date: '2030-05-07',
            overlap: {
              date: '2030-05-07',
              startTime: '18:30',
              endTime: '19:30',
            },
          },
        ],
      },
    })
  })

  it('applies revision and end-date changes in the draft', async () => {
    const schedule = await createSchedule({
      title: 'Routine',
      startDate: '2030-05-06',
      startTime: '18:00',
      endTime: '19:00',
      recurrence: { type: 'daily', interval: 1 },
    })
    const response = await app.request(
      `/api/schedule/events/${schedule.id}/constraint-check`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: '2030-05-06',
          endDate: '2030-05-12',
          draft: {
            constraints: {
              ...emptyConstraint([]),
              weeklyMin: 4,
              windowStart: '18:00',
              windowEnd: '20:00',
            },
            revisionChange: {
              effectiveFrom: '2030-05-07',
              startTime: '20:00',
              endTime: '21:00',
            },
            endDate: '2030-05-08',
            revisionMode: 'from',
          },
        }),
      },
    )

    expect(await constraintCheckSnapshot(response)).toEqual({
      status: 200,
      body: {
        constraintViolations: [
          {
            type: 'weekly-count-below-minimum',
            severity: 'required',
            date: '2030-05-06',
            weekStart: '2030-05-06',
            count: 3,
            minimum: 4,
          },
          {
            type: 'outside-time-window',
            severity: 'required',
            date: '2030-05-07',
            startTime: '20:00',
            endTime: '21:00',
            windowStart: '18:00',
            windowEnd: '20:00',
          },
          {
            type: 'outside-time-window',
            severity: 'required',
            date: '2030-05-08',
            startTime: '20:00',
            endTime: '21:00',
            windowStart: '18:00',
            windowEnd: '20:00',
          },
        ],
      },
    })
  })

  it('checks an if-free occurrence against a busy Google Calendar event', async () => {
    setGoogleEnv()
    const target = await createSchedule({
      title: 'Routine',
      startDate: '2030-05-07',
      startTime: '18:00',
      endTime: '19:00',
    })
    await upsertGoogleCalendarToken({
      accountId: 'google-sub-test',
      accountLabel: 'test@example.com',
      accessToken: 'valid-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            items: [
              {
                id: 'event-test',
                start: { dateTime: '2030-05-07T18:30:00Z' },
                end: { dateTime: '2030-05-07T19:30:00Z' },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    )

    const response = await app.request(
      `/api/schedule/events/${target.id}/constraint-check`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: '2030-05-06',
          endDate: '2030-05-12',
          draft: {
            constraints: emptyConstraint([
              { dayOfWeek: 2, preference: 'if_free' },
            ]),
          },
        }),
      },
    )

    expect(await constraintCheckSnapshot(response)).toEqual({
      status: 200,
      body: {
        constraintViolations: [
          {
            type: 'if-free-overlap',
            severity: 'required',
            date: '2030-05-07',
            overlap: {
              date: '2030-05-07',
              startTime: '18:30',
              endTime: '19:30',
            },
          },
        ],
      },
    })
  })
})

describe('schedule save responses', () => {
  it('returns violations with a schedule update without blocking the update', async () => {
    const schedule = await createSchedule({
      title: 'Routine',
      startDate: '2030-05-07',
      startTime: '18:00',
      endTime: '19:00',
    })
    await addScheduleConstraint(schedule.id, [
      { dayOfWeek: 2, preference: 'excluded' },
    ])
    const response = await app.request(`/api/schedule/events/${schedule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated routine' }),
    })
    expect(await scheduleResponseSnapshot(response)).toEqual({
      status: 200,
      body: {
        id: 'SCHEDULE_ID',
        title: 'Updated routine',
        startDate: '2030-05-07',
        endDate: null,
        remindBeforeMinutes: null,
        startTime: '18:00',
        endTime: '19:00',
        recurrence: null,
        context: 'personal',
        color: null,
        constraintViolations: [
          {
            type: 'excluded-weekday',
            severity: 'required',
            date: '2030-05-07',
          },
        ],
        createdAt: 'TIMESTAMP',
        updatedAt: 'TIMESTAMP',
      },
    })
  })

  it('returns violations after saving a moved occurrence without blocking the save', async () => {
    const schedule = await createSchedule({
      title: 'Routine',
      startDate: '2030-05-09',
      startTime: '18:00',
      endTime: '19:00',
      recurrence: { type: 'weekly', interval: 1, daysOfWeek: [4] },
    })
    await addScheduleConstraint(schedule.id, [
      { dayOfWeek: 5, preference: 'excluded' },
    ])
    const response = await app.request(
      `/api/schedule/events/${schedule.id}/overrides/2030-05-09`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: '2030-05-10',
          startTime: '18:00',
          endTime: '19:00',
        }),
      },
    )
    expect(await overrideResponseSnapshot(response)).toEqual({
      status: 200,
      body: {
        scheduleId: 'SCHEDULE_ID',
        occurrenceDate: '2030-05-09',
        startTime: '18:00',
        endTime: '19:00',
        movedToDate: '2030-05-10',
        skipped: false,
        constraintViolations: [
          {
            type: 'excluded-weekday',
            severity: 'required',
            date: '2030-05-10',
            originalDate: '2030-05-09',
          },
        ],
      },
    })
  })
})
