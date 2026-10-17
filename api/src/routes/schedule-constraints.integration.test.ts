import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import { scheduleConstraintWeekdays } from '#db/schema'
import { addCalendarDays, calendarDayOfWeek } from '#lib/timezone'
import { formatDateStr } from '#routes/schedule-expansion'
import { makeScheduleConstraint } from '#services/schedule-constraint-test-fixtures'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

async function createSchedule(startDate: string) {
  const response = await app.request('/api/schedule/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Routine',
      startDate,
      startTime: '18:00',
      endTime: '19:00',
    }),
  })
  return jsonBody<{ id: string }>(response)
}

function requestJson(method: string, path: string, body?: unknown) {
  return app.request(path, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  })
}

async function responseSnapshot(response: Response) {
  return {
    status: response.status,
    body: response.status === 204 ? null : await jsonBody(response),
  }
}

async function validationSnapshot(response: Response) {
  const body = await jsonBody<{
    success: false
    error: { name: string; message: string }
  }>(response)
  return {
    status: response.status,
    body: {
      success: body.success,
      error: {
        name: body.error.name,
        issues: JSON.parse(body.error.message) as unknown,
      },
    },
  }
}

describe('/api/schedule/events/:id/constraints', () => {
  it('returns null when a schedule has no constraint', async () => {
    const schedule = await createSchedule('2030-05-07')
    const response = await requestJson(
      'GET',
      `/api/schedule/events/${schedule.id}/constraints`,
    )

    expect(await responseSnapshot(response)).toEqual({
      status: 200,
      body: { constraint: null },
    })
  })

  it('round trips a normalized constraint', async () => {
    const schedule = await createSchedule('2030-05-07')
    const input = makeScheduleConstraint({
      maxConsecutiveDays: 2,
      weekdays: [
        { dayOfWeek: 5, preference: 'excluded' },
        { dayOfWeek: 1, preference: 'preferred' },
      ],
    })
    const setResponse = await requestJson(
      'PUT',
      `/api/schedule/events/${schedule.id}/constraints`,
      input,
    )
    const getResponse = await requestJson(
      'GET',
      `/api/schedule/events/${schedule.id}/constraints`,
    )
    const constraint = {
      ...input,
      weekdays: [{ dayOfWeek: 5, preference: 'excluded' }],
    }
    const snapshot = async () => ({
      set: await responseSnapshot(setResponse),
      get: await responseSnapshot(getResponse),
      storedWeekdays: await db
        .select({
          dayOfWeek: scheduleConstraintWeekdays.dayOfWeek,
          preference: scheduleConstraintWeekdays.preference,
        })
        .from(scheduleConstraintWeekdays)
        .where(eq(scheduleConstraintWeekdays.scheduleId, schedule.id)),
    })

    expect(await snapshot()).toEqual({
      set: {
        status: 200,
        body: { constraint, constraintViolations: [] },
      },
      get: { status: 200, body: { constraint } },
      storedWeekdays: [{ dayOfWeek: 5, preference: 'excluded' }],
    })
  })

  it('replaces weekday preferences on a second put', async () => {
    const schedule = await createSchedule('2030-05-07')
    await requestJson(
      'PUT',
      `/api/schedule/events/${schedule.id}/constraints`,
      makeScheduleConstraint({
        weekdays: [
          { dayOfWeek: 1, preference: 'if_free' },
          { dayOfWeek: 5, preference: 'excluded' },
        ],
      }),
    )
    const setResponse = await requestJson(
      'PUT',
      `/api/schedule/events/${schedule.id}/constraints`,
      makeScheduleConstraint({
        weekdays: [{ dayOfWeek: 3, preference: 'reserve' }],
      }),
    )
    const getResponse = await requestJson(
      'GET',
      `/api/schedule/events/${schedule.id}/constraints`,
    )
    const constraint = makeScheduleConstraint({
      weekdays: [{ dayOfWeek: 3, preference: 'reserve' }],
    })
    const snapshot = async () => ({
      set: await responseSnapshot(setResponse),
      get: await responseSnapshot(getResponse),
      storedWeekdays: await db
        .select({
          dayOfWeek: scheduleConstraintWeekdays.dayOfWeek,
          preference: scheduleConstraintWeekdays.preference,
        })
        .from(scheduleConstraintWeekdays)
        .where(eq(scheduleConstraintWeekdays.scheduleId, schedule.id)),
    })

    expect(await snapshot()).toEqual({
      set: {
        status: 200,
        body: { constraint, constraintViolations: [] },
      },
      get: { status: 200, body: { constraint } },
      storedWeekdays: [{ dayOfWeek: 3, preference: 'reserve' }],
    })
  })

  it('returns violations after saving an excluded weekday', async () => {
    const startDate = addCalendarDays(formatDateStr(new Date()), 1)
    const schedule = await createSchedule(startDate)
    const constraint = makeScheduleConstraint({
      weekdays: [
        {
          dayOfWeek: calendarDayOfWeek(startDate),
          preference: 'excluded',
        },
      ],
    })
    const response = await requestJson(
      'PUT',
      `/api/schedule/events/${schedule.id}/constraints`,
      constraint,
    )

    expect(await responseSnapshot(response)).toEqual({
      status: 200,
      body: {
        constraint,
        constraintViolations: [
          {
            type: 'excluded-weekday',
            severity: 'required',
            date: startDate,
          },
        ],
      },
    })
  })

  it('rejects invalid constraints without saving them', async () => {
    const schedule = await createSchedule('2030-05-07')
    const response = await requestJson(
      'PUT',
      `/api/schedule/events/${schedule.id}/constraints`,
      makeScheduleConstraint({ weeklyMin: 4, weeklyMax: 3 }),
    )
    const getResponse = await requestJson(
      'GET',
      `/api/schedule/events/${schedule.id}/constraints`,
    )
    const snapshot = async () => ({
      put: await validationSnapshot(response),
      get: await responseSnapshot(getResponse),
    })

    expect(await snapshot()).toEqual({
      put: {
        status: 400,
        body: {
          success: false,
          error: {
            name: 'ZodError',
            issues: [
              {
                code: 'custom',
                message: 'weeklyMin must not exceed weeklyMax',
                path: ['weeklyMin'],
              },
            ],
          },
        },
      },
      get: { status: 200, body: { constraint: null } },
    })
  })

  it('deletes a constraint without deleting its schedule', async () => {
    const schedule = await createSchedule('2030-05-07')
    await requestJson(
      'PUT',
      `/api/schedule/events/${schedule.id}/constraints`,
      makeScheduleConstraint(),
    )
    const deleteResponse = await requestJson(
      'DELETE',
      `/api/schedule/events/${schedule.id}/constraints`,
    )
    const getResponse = await requestJson(
      'GET',
      `/api/schedule/events/${schedule.id}/constraints`,
    )
    const snapshot = async () => ({
      deleted: await responseSnapshot(deleteResponse),
      afterDelete: await responseSnapshot(getResponse),
    })

    expect(await snapshot()).toEqual({
      deleted: { status: 204, body: null },
      afterDelete: { status: 200, body: { constraint: null } },
    })
  })

  it('returns not found for each method when the schedule is missing', async () => {
    const scheduleId = crypto.randomUUID()
    const input = makeScheduleConstraint()
    const responses = await Promise.all([
      requestJson('GET', `/api/schedule/events/${scheduleId}/constraints`),
      requestJson(
        'PUT',
        `/api/schedule/events/${scheduleId}/constraints`,
        input,
      ),
      requestJson('DELETE', `/api/schedule/events/${scheduleId}/constraints`),
    ])

    expect(await Promise.all(responses.map(responseSnapshot))).toEqual([
      { status: 404, body: { error: 'Schedule not found' } },
      { status: 404, body: { error: 'Schedule not found' } },
      { status: 404, body: { error: 'Schedule not found' } },
    ])
  })
})
