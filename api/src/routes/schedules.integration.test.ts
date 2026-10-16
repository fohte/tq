import { eq, inArray } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import { recurrenceRules, scheduleOverrides } from '#db/schema'
import { type ChangeEvent, subscribeToChangeEvents } from '#lib/change-events'
import {
  expandScheduleWithDraft,
  formatDateStr,
} from '#routes/schedule-expansion'
import type { ScheduleChangePreview } from '#routes/schedule-preview'
import { loadScheduleWithRevisions } from '#routes/schedule-shared'
import { assertDefined, jsonBody, setupTestDb } from '#testing'

setupTestDb()

let stopWatchingChanges: (() => void) | undefined

afterEach(() => {
  stopWatchingChanges?.()
  stopWatchingChanges = undefined
})

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000'

const invalidScheduleDateRanges = [
  ['invalid format', 'startDate=not-a-date&endDate=2099-01-01'],
  ['start after end', 'startDate=2099-01-02&endDate=2099-01-01'],
  ['more than 42 days', 'startDate=2099-01-01&endDate=2099-02-12'],
] as const

interface TimeBlockResponse {
  id: string
  taskId: string
  startTime: string
  endTime: string
  isAutoScheduled: boolean
  createdAt: string
  updatedAt: string
}

interface ScheduleResponse {
  id: string
  title: string
  startDate: string
  endDate: string | null
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
  createdAt: string
  updatedAt: string
}

interface ExpandedBlock {
  scheduleId: string
  title: string
  startDate: string
  start: string
  end: string
  context: string
  color: string | null
  occurrenceDate: string
  overridden: 'moved' | 'time' | null
  recurrence: ScheduleResponse['recurrence']
}

interface ScheduleOverrideSnapshot {
  scheduleId: string
  occurrenceDate: string
  startTime: string | null
  endTime: string | null
  movedToDate: string | null
  skipped: boolean
}

async function createTask(title: string, extra: Record<string, unknown> = {}) {
  const res = await app.request('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, ...extra }),
  })
  return jsonBody<{ id: string; number: number }>(res)
}

function watchChangeEvents() {
  const events: ChangeEvent[] = []
  stopWatchingChanges = subscribeToChangeEvents((event) => events.push(event))
  return events
}

function normalizeTimeBlock(block: TimeBlockResponse) {
  return { ...block, id: 'ID', createdAt: 'TIMESTAMP', updatedAt: 'TIMESTAMP' }
}

async function createTimeBlock(
  taskId: string | number,
  startTime: string,
  endTime: string,
  isAutoScheduled = false,
) {
  const res = await app.request('/api/schedule/time-blocks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId, startTime, endTime, isAutoScheduled }),
  })
  return { res, body: await jsonBody<TimeBlockResponse>(res) }
}

async function createSchedule(body: Record<string, unknown>) {
  const res = await app.request('/api/schedule/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: '2026-03-22', ...body }),
  })
  return { res, body: await jsonBody<ScheduleResponse>(res) }
}

function normalizeScheduleResponse(schedule: ScheduleResponse) {
  return {
    ...schedule,
    id: 'SCHEDULE_ID',
    recurrence: schedule.recurrence
      ? { ...schedule.recurrence, id: 'RECURRENCE_ID' }
      : null,
    createdAt: 'TIMESTAMP',
    updatedAt: 'TIMESTAMP',
  }
}

function normalizeExpandedBlocks(blocks: ExpandedBlock[]) {
  return blocks.map((block) => ({
    ...block,
    scheduleId: 'SCHEDULE_ID',
    recurrence: block.recurrence
      ? { ...block.recurrence, id: 'RECURRENCE_ID' }
      : null,
  }))
}

function expectedDailyOccurrence({
  occurrenceDate,
  start,
  end,
  overridden,
}: Pick<
  ExpandedBlock,
  'occurrenceDate' | 'start' | 'end' | 'overridden'
>): ExpandedBlock {
  return {
    scheduleId: 'SCHEDULE_ID',
    title: 'Routine',
    startDate: '2034-08-17',
    start,
    end,
    context: 'personal',
    color: null,
    occurrenceDate,
    overridden,
    recurrence: {
      id: 'RECURRENCE_ID',
      type: 'daily',
      interval: 1,
      daysOfWeek: null,
      dayOfMonth: null,
    },
  }
}

function normalizeScheduleHttpResponse(status: number, body: ScheduleResponse) {
  return { status, body: normalizeScheduleResponse(body) }
}

function normalizeExpandedHttpResponse(
  status: number,
  blocks: ExpandedBlock[],
) {
  return { status, blocks: normalizeExpandedBlocks(blocks) }
}

function normalizeCrossDateExpandedHttpResponse(
  status: number,
  blocks: ExpandedBlock[],
  nextDateStatus: number,
  nextDateBlocks: ExpandedBlock[],
) {
  return {
    status,
    blocks: normalizeExpandedBlocks(blocks),
    nextDateStatus,
    nextDateBlocks: normalizeExpandedBlocks(nextDateBlocks),
  }
}

async function normalizeValidationResponse(response: Response) {
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

async function putScheduleOverride(
  scheduleId: string,
  occurrenceDate: string,
  body: unknown,
) {
  return app.request(
    `/api/schedule/events/${scheduleId}/overrides/${occurrenceDate}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

function dateAtOffset(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return formatDateStr(date)
}

function dateOffsetFrom(dateStr: string, days: number) {
  const date = new Date(`${dateStr}T00:00:00`)
  date.setDate(date.getDate() + days)
  return formatDateStr(date)
}

function previewOccurrence(
  date: string,
  originalDate: string,
  startTime: string,
  endTime: string,
  skipped = false,
) {
  return { date, originalDate, startTime, endTime, skipped }
}

function normalizePreview(preview: ScheduleChangePreview) {
  return {
    ...preview,
    deletedOverrides: preview.deletedOverrides.map((override) => ({
      ...override,
      scheduleId: 'SCHEDULE_ID',
    })),
  }
}

function normalizeOverrideRows(rows: ScheduleOverrideSnapshot[]) {
  return rows.map((override) => ({
    ...override,
    scheduleId: 'SCHEDULE_ID',
  }))
}

async function patchSchedule(scheduleId: string, body: unknown) {
  return app.request(`/api/schedule/events/${scheduleId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function listScheduleEvents(startDate: string, endDate: string) {
  const response = await app.request(
    `/api/schedule/events?startDate=${startDate}&endDate=${endDate}`,
  )
  const blocks = await jsonBody<ExpandedBlock[]>(response)
  return {
    status: response.status,
    occurrences: blocks.map((block) => ({
      date: block.start.slice(0, 10),
      originalDate: block.occurrenceDate,
      startTime: block.start.slice(11, 16),
      endTime: block.end.slice(11, 16),
      skipped: false,
    })),
  }
}

async function listScheduleOverrides(scheduleId: string) {
  return db
    .select({
      scheduleId: scheduleOverrides.scheduleId,
      occurrenceDate: scheduleOverrides.occurrenceDate,
      startTime: scheduleOverrides.startTime,
      endTime: scheduleOverrides.endTime,
      movedToDate: scheduleOverrides.movedToDate,
      skipped: scheduleOverrides.skipped,
    })
    .from(scheduleOverrides)
    .where(eq(scheduleOverrides.scheduleId, scheduleId))
    .orderBy(scheduleOverrides.occurrenceDate)
}

describe('schedule/time-blocks API', () => {
  describe('POST /api/schedule/time-blocks', () => {
    it('emits the resolved task ID when creating a time block', async () => {
      const task = await createTask('Scheduled task')
      const events = watchChangeEvents()

      const { res } = await createTimeBlock(
        task.id,
        '2026-03-22T09:00:00.000Z',
        '2026-03-22T10:00:00.000Z',
      )

      const snapshot = () => ({ status: res.status, events })
      expect(snapshot()).toEqual({
        status: 201,
        events: [
          {
            resource: 'time_block',
            id: null,
            origin: null,
            taskIds: [task.id],
          },
        ],
      })
    })

    it('creates a time block', async () => {
      const task = await createTask('Test task')
      const { res, body } = await createTimeBlock(
        task.id,
        '2026-03-22T09:00:00.000Z',
        '2026-03-22T10:00:00.000Z',
      )

      expect(res.status).toBe(201)
      expect(body.taskId).toBe(task.id)
      expect(body.startTime).toBe('2026-03-22T09:00:00.000Z')
      expect(body.endTime).toBe('2026-03-22T10:00:00.000Z')
      expect(body.isAutoScheduled).toBe(false)
    })

    it('creates a time block for a task number', async () => {
      const task = await createTask('Numbered task')
      const { res, body } = await createTimeBlock(
        task.number,
        '2026-03-22T09:00:00.000Z',
        '2026-03-22T10:00:00.000Z',
      )

      const getActual = () => ({
        status: res.status,
        body: normalizeTimeBlock(body),
      })

      expect(getActual()).toEqual({
        status: 201,
        body: {
          id: 'ID',
          taskId: task.id,
          startTime: '2026-03-22T09:00:00.000Z',
          endTime: '2026-03-22T10:00:00.000Z',
          isAutoScheduled: false,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
      })
    })

    it('returns 400 when endTime is missing', async () => {
      const task = await createTask('No end time')
      const res = await app.request('/api/schedule/time-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          startTime: '2026-03-22T09:00:00.000Z',
        }),
      })

      expect(res.status).toBe(400)
    })

    it('returns the same not-found response for a missing UUID or task number', async () => {
      const results = await Promise.all(
        [TEST_UUID, 2147483647].map(async (taskId) => {
          const res = await app.request('/api/schedule/time-blocks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              taskId,
              startTime: '2026-03-22T09:00:00.000Z',
              endTime: '2026-03-22T10:00:00.000Z',
            }),
          })
          return {
            status: res.status,
            body: await jsonBody<{ error: string }>(res),
          }
        }),
      )

      expect(results).toEqual([
        { status: 404, body: { error: 'Task not found' } },
        { status: 404, body: { error: 'Task not found' } },
      ])
    })
  })

  describe('GET /api/schedule/time-blocks', () => {
    it.each(invalidScheduleDateRanges)(
      'returns 400 for a date range with %s',
      async (_, query) => {
        const res = await app.request(`/api/schedule/time-blocks?${query}`)

        expect(res.status).toBe(400)
      },
    )

    it('accepts an inclusive 42-day range', async () => {
      const res = await app.request(
        '/api/schedule/time-blocks?startDate=2099-01-01&endDate=2099-02-11',
      )

      expect(res.status).toBe(200)
    })

    it('returns time blocks for a given date', async () => {
      const task = await createTask('Test task')
      await createTimeBlock(
        task.id,
        '2026-03-22T09:00:00.000Z',
        '2026-03-22T10:00:00.000Z',
      )
      await createTimeBlock(
        task.id,
        '2026-03-22T14:00:00.000Z',
        '2026-03-22T15:00:00.000Z',
      )

      const res = await app.request(
        '/api/schedule/time-blocks?startDate=2026-03-22&endDate=2026-03-22',
      )
      expect(res.status).toBe(200)

      const blocks = await jsonBody<TimeBlockResponse[]>(res)
      expect(blocks.length).toBe(2)
      assertDefined(blocks[0])
      expect(blocks[0].startTime).toBe('2026-03-22T09:00:00.000Z')
    })

    it('returns empty array when no blocks exist', async () => {
      const res = await app.request(
        '/api/schedule/time-blocks?startDate=2026-03-22&endDate=2026-03-22',
      )
      expect(res.status).toBe(200)

      const blocks = await jsonBody<TimeBlockResponse[]>(res)
      expect(blocks.length).toBe(0)
    })

    it('returns time blocks spanning multiple days within the range', async () => {
      const task = await createTask('Test task')
      await createTimeBlock(
        task.id,
        '2026-03-22T09:00:00.000Z',
        '2026-03-22T10:00:00.000Z',
      )
      await createTimeBlock(
        task.id,
        '2026-03-24T09:00:00.000Z',
        '2026-03-24T10:00:00.000Z',
      )
      // Outside the requested range — must not be returned.
      await createTimeBlock(
        task.id,
        '2026-03-26T09:00:00.000Z',
        '2026-03-26T10:00:00.000Z',
      )

      const res = await app.request(
        '/api/schedule/time-blocks?startDate=2026-03-22&endDate=2026-03-24',
      )
      expect(res.status).toBe(200)

      const blocks = await jsonBody<TimeBlockResponse[]>(res)
      expect(blocks.map((b) => b.startTime)).toEqual([
        '2026-03-22T09:00:00.000Z',
        '2026-03-24T09:00:00.000Z',
      ])
    })
  })

  describe('PATCH /api/schedule/time-blocks/:id', () => {
    it('emits the time block task ID when updating a time block', async () => {
      const task = await createTask('Movable task')
      const { body: created } = await createTimeBlock(
        task.id,
        '2026-03-22T09:00:00.000Z',
        '2026-03-22T10:00:00.000Z',
      )
      const events = watchChangeEvents()

      const res = await app.request(`/api/schedule/time-blocks/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startTime: '2026-03-22T11:00:00.000Z' }),
      })

      const snapshot = () => ({ status: res.status, events })
      expect(snapshot()).toEqual({
        status: 200,
        events: [
          {
            resource: 'time_block',
            id: created.id,
            origin: null,
            taskIds: [task.id],
          },
        ],
      })
    })

    it('updates start and end time (simulating drag move)', async () => {
      const task = await createTask('Movable task')
      const { body: created } = await createTimeBlock(
        task.id,
        '2026-03-22T09:00:00.000Z',
        '2026-03-22T10:00:00.000Z',
      )

      const res = await app.request(`/api/schedule/time-blocks/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: '2026-03-22T11:00:00.000Z',
          endTime: '2026-03-22T12:00:00.000Z',
        }),
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<TimeBlockResponse>(res)
      expect(body.startTime).toBe('2026-03-22T11:00:00.000Z')
      expect(body.endTime).toBe('2026-03-22T12:00:00.000Z')
    })

    it('updates only end time (simulating resize)', async () => {
      const task = await createTask('Resizable task')
      const { body: created } = await createTimeBlock(
        task.id,
        '2026-03-22T09:00:00.000Z',
        '2026-03-22T10:00:00.000Z',
      )

      const res = await app.request(`/api/schedule/time-blocks/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endTime: '2026-03-22T11:30:00.000Z',
        }),
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<TimeBlockResponse>(res)
      expect(body.startTime).toBe('2026-03-22T09:00:00.000Z')
      expect(body.endTime).toBe('2026-03-22T11:30:00.000Z')
    })

    it('returns 404 for non-existent time block', async () => {
      const res = await app.request(`/api/schedule/time-blocks/${TEST_UUID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: '2026-03-22T11:00:00.000Z',
        }),
      })

      expect(res.status).toBe(404)
    })

    it('promotes an auto-scheduled block to manual (simulating drag adjustment)', async () => {
      const task = await createTask('Auto-placed task')
      const { body: created } = await createTimeBlock(
        task.id,
        '2026-03-22T09:00:00.000Z',
        '2026-03-22T10:00:00.000Z',
        /* isAutoScheduled */ true,
      )

      const res = await app.request(`/api/schedule/time-blocks/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: '2026-03-22T11:00:00.000Z',
          endTime: '2026-03-22T12:00:00.000Z',
          isAutoScheduled: false,
        }),
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<TimeBlockResponse>(res)
      expect(normalizeTimeBlock(body)).toEqual({
        id: 'ID',
        taskId: task.id,
        startTime: '2026-03-22T11:00:00.000Z',
        endTime: '2026-03-22T12:00:00.000Z',
        isAutoScheduled: false,
        createdAt: 'TIMESTAMP',
        updatedAt: 'TIMESTAMP',
      })
    })
  })

  describe('DELETE /api/schedule/time-blocks/:id', () => {
    it('emits the time block task ID when deleting a time block', async () => {
      const task = await createTask('Deletable task')
      const { body: created } = await createTimeBlock(
        task.id,
        '2026-03-22T09:00:00.000Z',
        '2026-03-22T10:00:00.000Z',
      )
      const events = watchChangeEvents()

      const res = await app.request(`/api/schedule/time-blocks/${created.id}`, {
        method: 'DELETE',
      })

      const snapshot = () => ({ status: res.status, events })
      expect(snapshot()).toEqual({
        status: 204,
        events: [
          {
            resource: 'time_block',
            id: created.id,
            origin: null,
            taskIds: [task.id],
          },
        ],
      })
    })

    it('deletes a time block', async () => {
      const task = await createTask('Deletable task')
      const { body: created } = await createTimeBlock(
        task.id,
        '2026-03-22T09:00:00.000Z',
        '2026-03-22T10:00:00.000Z',
      )

      const res = await app.request(`/api/schedule/time-blocks/${created.id}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(204)

      // Verify it's gone
      const listRes = await app.request(
        '/api/schedule/time-blocks?startDate=2026-03-22&endDate=2026-03-22',
      )
      const blocks = await jsonBody<TimeBlockResponse[]>(listRes)
      expect(blocks.length).toBe(0)
    })

    it('returns 404 for non-existent time block', async () => {
      const res = await app.request(`/api/schedule/time-blocks/${TEST_UUID}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(404)
    })
  })
})

describe('schedules API', () => {
  describe('POST /api/schedule/events', () => {
    it('creates a schedule without recurrence', async () => {
      const { res, body } = await createSchedule({
        title: 'Sleep',
        startDate: '2026-03-23',
        startTime: '23:00',
        endTime: '07:00',
      })

      expect(normalizeScheduleHttpResponse(res.status, body)).toEqual({
        status: 201,
        body: {
          id: 'SCHEDULE_ID',
          title: 'Sleep',
          startDate: '2026-03-23',
          endDate: null,
          startTime: '23:00',
          endTime: '07:00',
          recurrence: null,
          context: 'personal',
          color: null,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
      })
    })

    it('creates a schedule with weekly recurrence', async () => {
      const { res, body } = await createSchedule({
        title: 'Gym',
        startTime: '18:00',
        endTime: '19:00',
        recurrence: {
          type: 'weekly',
          interval: 1,
          daysOfWeek: [1, 3, 5],
        },
        context: 'personal',
        color: '#FF6B6B',
      })

      expect(res.status).toBe(201)
      expect(body.title).toBe('Gym')
      assertDefined(body.recurrence)
      expect(body.recurrence.type).toBe('weekly')
      expect(body.recurrence.daysOfWeek).toEqual([1, 3, 5])
      expect(body.color).toBe('#FF6B6B')
    })

    it('returns 400 for missing title', async () => {
      const res = await app.request('/api/schedule/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: '09:00',
          endTime: '10:00',
        }),
      })
      expect(res.status).toBe(400)
    })

    it('returns 400 when startDate is missing', async () => {
      const res = await app.request('/api/schedule/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Routine',
          startTime: '09:00',
          endTime: '10:00',
        }),
      })

      expect(res.status).toBe(400)
    })

    it('returns 400 for an impossible startDate', async () => {
      const res = await app.request('/api/schedule/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Routine',
          startDate: '2026-02-30',
          startTime: '09:00',
          endTime: '10:00',
        }),
      })

      expect(res.status).toBe(400)
    })

    it('returns 400 for invalid time format', async () => {
      const res = await app.request('/api/schedule/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Bad Time',
          startTime: '9:00',
          endTime: '10:00',
        }),
      })
      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/schedule/events', () => {
    it.each(invalidScheduleDateRanges)(
      'returns 400 for a date range with %s',
      async (_, query) => {
        const res = await app.request(`/api/schedule/events?${query}`)

        expect(res.status).toBe(400)
      },
    )

    it('accepts an inclusive 42-day range', async () => {
      const res = await app.request(
        '/api/schedule/events?startDate=2099-01-01&endDate=2099-02-11',
      )

      expect(res.status).toBe(200)
    })

    it('returns expanded schedules for a date', async () => {
      await createSchedule({
        title: 'Morning Routine',
        startTime: '06:00',
        endTime: '07:00',
      })

      const res = await app.request(
        '/api/schedule/events?startDate=2026-03-22&endDate=2026-03-22',
      )
      expect(res.status).toBe(200)

      const blocks = await jsonBody<ExpandedBlock[]>(res)
      expect(blocks).toHaveLength(1)
      assertDefined(blocks[0])
      expect(blocks[0].title).toBe('Morning Routine')
      expect(blocks[0].start).toBe('2026-03-22T06:00:00')
      expect(blocks[0].end).toBe('2026-03-22T07:00:00')
    })

    it('returns a one-off schedule only on its startDate', async () => {
      await createSchedule({
        title: 'Single Event',
        startDate: '2026-03-23',
        startTime: '09:00',
        endTime: '10:00',
      })

      const res = await app.request(
        '/api/schedule/events?startDate=2026-03-22&endDate=2026-03-24',
      )

      expect(
        normalizeExpandedHttpResponse(
          res.status,
          await jsonBody<ExpandedBlock[]>(res),
        ),
      ).toEqual({
        status: 200,
        blocks: [
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Single Event',
            startDate: '2026-03-23',
            start: '2026-03-23T09:00:00',
            end: '2026-03-23T10:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-23',
            overridden: null,
            recurrence: null,
          },
        ],
      })
    })

    it('returns cross-midnight blocks correctly', async () => {
      await createSchedule({
        title: 'Sleep',
        startTime: '23:00',
        endTime: '07:00',
      })

      const res = await app.request(
        '/api/schedule/events?startDate=2026-03-22&endDate=2026-03-22',
      )
      const blocks = await jsonBody<ExpandedBlock[]>(res)
      const nextDateRes = await app.request(
        '/api/schedule/events?startDate=2026-03-23&endDate=2026-03-23',
      )
      const nextDateBlocks = await jsonBody<ExpandedBlock[]>(nextDateRes)

      expect(
        normalizeCrossDateExpandedHttpResponse(
          res.status,
          blocks,
          nextDateRes.status,
          nextDateBlocks,
        ),
      ).toEqual({
        status: 200,
        blocks: [
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Sleep',
            startDate: '2026-03-22',
            start: '2026-03-22T23:00:00',
            end: '2026-03-23T00:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-22',
            overridden: null,
            recurrence: null,
          },
        ],
        nextDateStatus: 200,
        nextDateBlocks: [
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Sleep',
            startDate: '2026-03-22',
            start: '2026-03-23T00:00:00',
            end: '2026-03-23T07:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-22',
            overridden: null,
            recurrence: null,
          },
        ],
      })
    })

    it('filters by weekly recurrence rule', async () => {
      await createSchedule({
        title: 'Gym',
        startTime: '18:00',
        endTime: '19:00',
        recurrence: {
          type: 'weekly',
          interval: 1,
          daysOfWeek: [1, 3, 5],
        },
      })

      // 2026-03-23 is Monday
      const mondayRes = await app.request(
        '/api/schedule/events?startDate=2026-03-23&endDate=2026-03-23',
      )
      const mondayBlocks = await jsonBody<ExpandedBlock[]>(mondayRes)
      expect(mondayBlocks).toHaveLength(1)

      // 2026-03-24 is Tuesday
      const tuesdayRes = await app.request(
        '/api/schedule/events?startDate=2026-03-24&endDate=2026-03-24',
      )
      const tuesdayBlocks = await jsonBody<ExpandedBlock[]>(tuesdayRes)
      expect(tuesdayBlocks).toHaveLength(0)
    })

    it('expands a recurring schedule across every matching day within the range', async () => {
      await createSchedule({
        title: 'Gym',
        startTime: '18:00',
        endTime: '19:00',
        recurrence: {
          type: 'weekly',
          interval: 1,
          daysOfWeek: [1, 3, 5],
        },
      })

      // 2026-03-23 (Mon) through 2026-03-25 (Wed) — matches Mon and Wed only.
      const res = await app.request(
        '/api/schedule/events?startDate=2026-03-23&endDate=2026-03-25',
      )
      expect(res.status).toBe(200)

      const blocks = await jsonBody<ExpandedBlock[]>(res)
      expect(blocks.map((b) => b.start)).toEqual([
        '2026-03-23T18:00:00',
        '2026-03-25T18:00:00',
      ])
    })

    it('does not expand matching recurrence dates before startDate', async () => {
      await createSchedule({
        title: 'Gym',
        startDate: '2026-03-24',
        startTime: '18:00',
        endTime: '19:00',
        recurrence: {
          type: 'weekly',
          interval: 1,
          daysOfWeek: [1],
        },
      })

      const res = await app.request(
        '/api/schedule/events?startDate=2026-03-23&endDate=2026-03-30',
      )

      expect(
        normalizeExpandedHttpResponse(
          res.status,
          await jsonBody<ExpandedBlock[]>(res),
        ),
      ).toEqual({
        status: 200,
        blocks: [
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Gym',
            startDate: '2026-03-24',
            start: '2026-03-30T18:00:00',
            end: '2026-03-30T19:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-30',
            overridden: null,
            recurrence: {
              id: 'RECURRENCE_ID',
              type: 'weekly',
              interval: 1,
              daysOfWeek: [1],
              dayOfMonth: null,
            },
          },
        ],
      })
    })
  })

  describe('PATCH /api/schedule/events/:id', () => {
    it('previews a start date change that replaces existing revisions', async () => {
      const startDate = dateAtOffset(0)
      const newStartDate = dateOffsetFrom(startDate, 1)
      const secondRevisionDate = dateOffsetFrom(startDate, 2)
      const endDate = dateOffsetFrom(startDate, 4)
      const { body: created } = await createSchedule({
        title: 'Daily review',
        startDate,
        startTime: '08:00',
        endTime: '09:00',
        recurrence: { type: 'daily', interval: 1 },
      })
      await patchSchedule(created.id, { endDate })
      await patchSchedule(created.id, {
        effectiveFrom: secondRevisionDate,
        startTime: '09:00',
        endTime: '10:00',
      })

      const beforeSave = await listScheduleEvents(startDate, endDate)
      const dryRunResponse = await patchSchedule(created.id, {
        startDate: newStartDate,
        dryRun: true,
      })
      const preview = await jsonBody<ScheduleChangePreview>(dryRunResponse)
      const duringDryRun = await listScheduleEvents(startDate, endDate)
      const saveResponse = await patchSchedule(created.id, {
        startDate: newStartDate,
      })
      const afterSave = await listScheduleEvents(startDate, endDate)

      const snapshot = () => ({
        dryRunStatus: dryRunResponse.status,
        preview: normalizePreview(preview),
        beforeSave: beforeSave.occurrences,
        duringDryRun: duringDryRun.occurrences,
        saveStatus: saveResponse.status,
        afterSave: afterSave.occurrences,
      })
      expect(snapshot()).toEqual({
        dryRunStatus: 200,
        preview: {
          range: {
            startDate,
            endDate: dateOffsetFrom(startDate, 41),
          },
          changes: [
            {
              before: previewOccurrence(startDate, startDate, '08:00', '09:00'),
              after: null,
            },
            {
              before: previewOccurrence(
                secondRevisionDate,
                secondRevisionDate,
                '09:00',
                '10:00',
              ),
              after: previewOccurrence(
                secondRevisionDate,
                secondRevisionDate,
                '08:00',
                '09:00',
              ),
            },
            {
              before: previewOccurrence(
                dateOffsetFrom(startDate, 3),
                dateOffsetFrom(startDate, 3),
                '09:00',
                '10:00',
              ),
              after: previewOccurrence(
                dateOffsetFrom(startDate, 3),
                dateOffsetFrom(startDate, 3),
                '08:00',
                '09:00',
              ),
            },
            {
              before: previewOccurrence(endDate, endDate, '09:00', '10:00'),
              after: previewOccurrence(endDate, endDate, '08:00', '09:00'),
            },
          ],
          deletedOverrides: [],
        },
        beforeSave: [
          previewOccurrence(startDate, startDate, '08:00', '09:00'),
          previewOccurrence(newStartDate, newStartDate, '08:00', '09:00'),
          previewOccurrence(
            secondRevisionDate,
            secondRevisionDate,
            '09:00',
            '10:00',
          ),
          previewOccurrence(
            dateOffsetFrom(startDate, 3),
            dateOffsetFrom(startDate, 3),
            '09:00',
            '10:00',
          ),
          previewOccurrence(endDate, endDate, '09:00', '10:00'),
        ],
        duringDryRun: [
          previewOccurrence(startDate, startDate, '08:00', '09:00'),
          previewOccurrence(newStartDate, newStartDate, '08:00', '09:00'),
          previewOccurrence(
            secondRevisionDate,
            secondRevisionDate,
            '09:00',
            '10:00',
          ),
          previewOccurrence(
            dateOffsetFrom(startDate, 3),
            dateOffsetFrom(startDate, 3),
            '09:00',
            '10:00',
          ),
          previewOccurrence(endDate, endDate, '09:00', '10:00'),
        ],
        saveStatus: 200,
        afterSave: [
          previewOccurrence(newStartDate, newStartDate, '08:00', '09:00'),
          previewOccurrence(
            secondRevisionDate,
            secondRevisionDate,
            '08:00',
            '09:00',
          ),
          previewOccurrence(
            dateOffsetFrom(startDate, 3),
            dateOffsetFrom(startDate, 3),
            '08:00',
            '09:00',
          ),
          previewOccurrence(endDate, endDate, '08:00', '09:00'),
        ],
      })
    })

    it('includes new occurrences when a start date moves earlier', async () => {
      const newStartDate = dateAtOffset(0)
      const startDate = dateOffsetFrom(newStartDate, 1)
      const endDate = dateOffsetFrom(startDate, 2)
      const { body: created } = await createSchedule({
        title: 'Daily review',
        startDate,
        startTime: '08:00',
        endTime: '09:00',
        recurrence: { type: 'daily', interval: 1 },
      })
      await patchSchedule(created.id, { endDate })

      const beforeSave = await listScheduleEvents(newStartDate, endDate)
      const dryRunResponse = await patchSchedule(created.id, {
        startDate: newStartDate,
        dryRun: true,
      })
      const preview = await jsonBody<ScheduleChangePreview>(dryRunResponse)
      const duringDryRun = await listScheduleEvents(newStartDate, endDate)
      const saveResponse = await patchSchedule(created.id, {
        startDate: newStartDate,
      })
      const afterSave = await listScheduleEvents(newStartDate, endDate)

      const snapshot = () => ({
        dryRunStatus: dryRunResponse.status,
        preview: normalizePreview(preview),
        beforeSave: beforeSave.occurrences,
        duringDryRun: duringDryRun.occurrences,
        saveStatus: saveResponse.status,
        afterSave: afterSave.occurrences,
      })
      expect(snapshot()).toEqual({
        dryRunStatus: 200,
        preview: {
          range: {
            startDate: newStartDate,
            endDate: dateOffsetFrom(newStartDate, 41),
          },
          changes: [
            {
              before: null,
              after: previewOccurrence(
                newStartDate,
                newStartDate,
                '08:00',
                '09:00',
              ),
            },
          ],
          deletedOverrides: [],
        },
        beforeSave: [
          previewOccurrence(startDate, startDate, '08:00', '09:00'),
          previewOccurrence(
            dateOffsetFrom(startDate, 1),
            dateOffsetFrom(startDate, 1),
            '08:00',
            '09:00',
          ),
          previewOccurrence(endDate, endDate, '08:00', '09:00'),
        ],
        duringDryRun: [
          previewOccurrence(startDate, startDate, '08:00', '09:00'),
          previewOccurrence(
            dateOffsetFrom(startDate, 1),
            dateOffsetFrom(startDate, 1),
            '08:00',
            '09:00',
          ),
          previewOccurrence(endDate, endDate, '08:00', '09:00'),
        ],
        saveStatus: 200,
        afterSave: [
          previewOccurrence(newStartDate, newStartDate, '08:00', '09:00'),
          previewOccurrence(startDate, startDate, '08:00', '09:00'),
          previewOccurrence(
            dateOffsetFrom(startDate, 1),
            dateOffsetFrom(startDate, 1),
            '08:00',
            '09:00',
          ),
          previewOccurrence(endDate, endDate, '08:00', '09:00'),
        ],
      })
    })

    it('previews revision changes from effectiveFrom and removes obsolete overrides only when saved', async () => {
      const startDate = dateAtOffset(0)
      const firstChangedDate = dateOffsetFrom(startDate, 1)
      const secondChangedDate = dateOffsetFrom(startDate, 2)
      const lastDate = dateOffsetFrom(startDate, 3)
      const { body: created } = await createSchedule({
        title: 'Daily review',
        startDate,
        startTime: '08:00',
        endTime: '09:00',
        recurrence: { type: 'daily', interval: 1 },
      })
      await patchSchedule(created.id, { endDate: lastDate })
      await putScheduleOverride(created.id, firstChangedDate, {
        startTime: '07:00',
        endTime: '08:00',
      })
      await putScheduleOverride(created.id, secondChangedDate, {
        date: lastDate,
        startTime: '11:00',
        endTime: '12:00',
      })

      const beforeSave = await listScheduleEvents(firstChangedDate, lastDate)
      const dryRunInput = {
        effectiveFrom: firstChangedDate,
        startTime: '13:00',
        endTime: '14:00',
        recurrence: {
          type: 'weekly',
          interval: 1,
          daysOfWeek: [new Date(`${lastDate}T00:00:00`).getDay()],
        },
        dryRun: true,
      }
      const dryRunResponse = await patchSchedule(created.id, dryRunInput)
      const preview = await jsonBody<ScheduleChangePreview>(dryRunResponse)
      const duringDryRun = await listScheduleEvents(firstChangedDate, lastDate)
      const overridesDuringDryRun = await listScheduleOverrides(created.id)
      const saveResponse = await patchSchedule(created.id, {
        ...dryRunInput,
        dryRun: undefined,
      })
      const afterSave = await listScheduleEvents(firstChangedDate, lastDate)
      const overridesAfterSave = await listScheduleOverrides(created.id)

      const snapshot = () => ({
        dryRunStatus: dryRunResponse.status,
        preview: normalizePreview(preview),
        beforeSave: beforeSave.occurrences,
        duringDryRun: duringDryRun.occurrences,
        overridesDuringDryRun: normalizeOverrideRows(overridesDuringDryRun),
        saveStatus: saveResponse.status,
        afterSave: afterSave.occurrences,
        overridesAfterSave: normalizeOverrideRows(overridesAfterSave),
      })
      expect(snapshot()).toEqual({
        dryRunStatus: 200,
        preview: {
          range: {
            startDate: firstChangedDate,
            endDate: dateOffsetFrom(firstChangedDate, 41),
          },
          changes: [
            {
              before: previewOccurrence(
                firstChangedDate,
                firstChangedDate,
                '07:00',
                '08:00',
              ),
              after: null,
            },
            {
              before: previewOccurrence(
                lastDate,
                secondChangedDate,
                '11:00',
                '12:00',
              ),
              after: null,
            },
            {
              before: previewOccurrence(lastDate, lastDate, '08:00', '09:00'),
              after: previewOccurrence(lastDate, lastDate, '13:00', '14:00'),
            },
          ],
          deletedOverrides: [
            {
              scheduleId: 'SCHEDULE_ID',
              occurrenceDate: firstChangedDate,
              startTime: '07:00',
              endTime: '08:00',
              movedToDate: null,
              skipped: false,
            },
            {
              scheduleId: 'SCHEDULE_ID',
              occurrenceDate: secondChangedDate,
              startTime: '11:00',
              endTime: '12:00',
              movedToDate: lastDate,
              skipped: false,
            },
          ],
        },
        beforeSave: [
          previewOccurrence(
            firstChangedDate,
            firstChangedDate,
            '07:00',
            '08:00',
          ),
          previewOccurrence(lastDate, lastDate, '08:00', '09:00'),
          previewOccurrence(lastDate, secondChangedDate, '11:00', '12:00'),
        ],
        duringDryRun: [
          previewOccurrence(
            firstChangedDate,
            firstChangedDate,
            '07:00',
            '08:00',
          ),
          previewOccurrence(lastDate, lastDate, '08:00', '09:00'),
          previewOccurrence(lastDate, secondChangedDate, '11:00', '12:00'),
        ],
        overridesDuringDryRun: [
          {
            scheduleId: 'SCHEDULE_ID',
            occurrenceDate: firstChangedDate,
            startTime: '07:00',
            endTime: '08:00',
            movedToDate: null,
            skipped: false,
          },
          {
            scheduleId: 'SCHEDULE_ID',
            occurrenceDate: secondChangedDate,
            startTime: '11:00',
            endTime: '12:00',
            movedToDate: lastDate,
            skipped: false,
          },
        ],
        saveStatus: 200,
        afterSave: [previewOccurrence(lastDate, lastDate, '13:00', '14:00')],
        overridesAfterSave: [],
      })
    })

    it('previews updates to all revisions and keeps the preview unchanged until saved', async () => {
      const startDate = dateAtOffset(0)
      const firstRevisionDate = dateOffsetFrom(startDate, 1)
      const lastDate = dateOffsetFrom(startDate, 2)
      const { body: created } = await createSchedule({
        title: 'Daily review',
        startDate,
        startTime: '08:00',
        endTime: '09:00',
        recurrence: { type: 'daily', interval: 1 },
      })
      await patchSchedule(created.id, { endDate: lastDate })
      await patchSchedule(created.id, {
        effectiveFrom: firstRevisionDate,
        startTime: '09:00',
        endTime: '10:00',
      })

      const beforeSave = await listScheduleEvents(startDate, lastDate)
      const dryRunInput = {
        startTime: '12:00',
        endTime: '13:00',
        dryRun: true,
      }
      const dryRunResponse = await patchSchedule(created.id, dryRunInput)
      const preview = await jsonBody<ScheduleChangePreview>(dryRunResponse)
      const series = await loadScheduleWithRevisions(created.id)
      assertDefined(series)
      const publicExpansion = expandScheduleWithDraft({
        series,
        overrides: await listScheduleOverrides(created.id),
        startDate: preview.range.startDate,
        endDate: preview.range.endDate,
        draft: {
          revisionChange: {
            effectiveFrom: startDate,
            startTime: '12:00',
            endTime: '13:00',
          },
        },
        revisionMode: 'all',
      })
      const previewAfter = preview.changes.flatMap((change) =>
        change.after == null ? [] : [change.after],
      )
      const duringDryRun = await listScheduleEvents(startDate, lastDate)
      const saveResponse = await patchSchedule(created.id, {
        ...dryRunInput,
        dryRun: undefined,
      })
      const afterSave = await listScheduleEvents(startDate, lastDate)

      const snapshot = () => ({
        dryRunStatus: dryRunResponse.status,
        preview: normalizePreview(preview),
        publicExpansion,
        previewAfter,
        beforeSave: beforeSave.occurrences,
        duringDryRun: duringDryRun.occurrences,
        saveStatus: saveResponse.status,
        afterSave: afterSave.occurrences,
      })
      expect(snapshot()).toEqual({
        dryRunStatus: 200,
        preview: {
          range: {
            startDate,
            endDate: dateOffsetFrom(startDate, 41),
          },
          changes: [
            {
              before: previewOccurrence(startDate, startDate, '08:00', '09:00'),
              after: previewOccurrence(startDate, startDate, '12:00', '13:00'),
            },
            {
              before: previewOccurrence(
                firstRevisionDate,
                firstRevisionDate,
                '09:00',
                '10:00',
              ),
              after: previewOccurrence(
                firstRevisionDate,
                firstRevisionDate,
                '12:00',
                '13:00',
              ),
            },
            {
              before: previewOccurrence(lastDate, lastDate, '09:00', '10:00'),
              after: previewOccurrence(lastDate, lastDate, '12:00', '13:00'),
            },
          ],
          deletedOverrides: [],
        },
        publicExpansion: [
          previewOccurrence(startDate, startDate, '12:00', '13:00'),
          previewOccurrence(
            firstRevisionDate,
            firstRevisionDate,
            '12:00',
            '13:00',
          ),
          previewOccurrence(lastDate, lastDate, '12:00', '13:00'),
        ],
        previewAfter: [
          previewOccurrence(startDate, startDate, '12:00', '13:00'),
          previewOccurrence(
            firstRevisionDate,
            firstRevisionDate,
            '12:00',
            '13:00',
          ),
          previewOccurrence(lastDate, lastDate, '12:00', '13:00'),
        ],
        beforeSave: [
          previewOccurrence(startDate, startDate, '08:00', '09:00'),
          previewOccurrence(
            firstRevisionDate,
            firstRevisionDate,
            '09:00',
            '10:00',
          ),
          previewOccurrence(lastDate, lastDate, '09:00', '10:00'),
        ],
        duringDryRun: [
          previewOccurrence(startDate, startDate, '08:00', '09:00'),
          previewOccurrence(
            firstRevisionDate,
            firstRevisionDate,
            '09:00',
            '10:00',
          ),
          previewOccurrence(lastDate, lastDate, '09:00', '10:00'),
        ],
        saveStatus: 200,
        afterSave: [
          previewOccurrence(startDate, startDate, '12:00', '13:00'),
          previewOccurrence(
            firstRevisionDate,
            firstRevisionDate,
            '12:00',
            '13:00',
          ),
          previewOccurrence(lastDate, lastDate, '12:00', '13:00'),
        ],
      })
    })

    it('previews ending a schedule and deletes later overrides only when saved', async () => {
      const startDate = dateAtOffset(0)
      const firstRemovedDate = dateOffsetFrom(startDate, 2)
      const lastRemovedDate = dateOffsetFrom(startDate, 3)
      const lastDate = dateOffsetFrom(startDate, 4)
      const { body: created } = await createSchedule({
        title: 'Daily review',
        startDate,
        startTime: '08:00',
        endTime: '09:00',
        recurrence: { type: 'daily', interval: 1 },
      })
      await patchSchedule(created.id, { endDate: lastDate })
      await putScheduleOverride(created.id, firstRemovedDate, {
        startTime: '10:00',
        endTime: '11:00',
      })
      await putScheduleOverride(created.id, lastRemovedDate, {
        startTime: '11:00',
        endTime: '12:00',
      })

      const beforeSave = await listScheduleEvents(startDate, lastDate)
      const dryRunResponse = await patchSchedule(created.id, {
        endDate: dateOffsetFrom(startDate, 1),
        dryRun: true,
      })
      const preview = await jsonBody<ScheduleChangePreview>(dryRunResponse)
      const duringDryRun = await listScheduleEvents(startDate, lastDate)
      const overridesDuringDryRun = await listScheduleOverrides(created.id)
      const saveResponse = await patchSchedule(created.id, {
        endDate: dateOffsetFrom(startDate, 1),
      })
      const afterSave = await listScheduleEvents(startDate, lastDate)
      const overridesAfterSave = await listScheduleOverrides(created.id)

      const snapshot = () => ({
        dryRunStatus: dryRunResponse.status,
        preview: normalizePreview(preview),
        beforeSave: beforeSave.occurrences,
        duringDryRun: duringDryRun.occurrences,
        overridesDuringDryRun: normalizeOverrideRows(overridesDuringDryRun),
        saveStatus: saveResponse.status,
        afterSave: afterSave.occurrences,
        overridesAfterSave: normalizeOverrideRows(overridesAfterSave),
      })
      expect(snapshot()).toEqual({
        dryRunStatus: 200,
        preview: {
          range: {
            startDate,
            endDate: dateOffsetFrom(startDate, 41),
          },
          changes: [
            {
              before: previewOccurrence(
                firstRemovedDate,
                firstRemovedDate,
                '10:00',
                '11:00',
              ),
              after: null,
            },
            {
              before: previewOccurrence(
                lastRemovedDate,
                lastRemovedDate,
                '11:00',
                '12:00',
              ),
              after: null,
            },
            {
              before: previewOccurrence(lastDate, lastDate, '08:00', '09:00'),
              after: null,
            },
          ],
          deletedOverrides: [
            {
              scheduleId: 'SCHEDULE_ID',
              occurrenceDate: firstRemovedDate,
              startTime: '10:00',
              endTime: '11:00',
              movedToDate: null,
              skipped: false,
            },
            {
              scheduleId: 'SCHEDULE_ID',
              occurrenceDate: lastRemovedDate,
              startTime: '11:00',
              endTime: '12:00',
              movedToDate: null,
              skipped: false,
            },
          ],
        },
        beforeSave: [
          previewOccurrence(startDate, startDate, '08:00', '09:00'),
          previewOccurrence(
            dateOffsetFrom(startDate, 1),
            dateOffsetFrom(startDate, 1),
            '08:00',
            '09:00',
          ),
          previewOccurrence(
            firstRemovedDate,
            firstRemovedDate,
            '10:00',
            '11:00',
          ),
          previewOccurrence(lastRemovedDate, lastRemovedDate, '11:00', '12:00'),
          previewOccurrence(lastDate, lastDate, '08:00', '09:00'),
        ],
        duringDryRun: [
          previewOccurrence(startDate, startDate, '08:00', '09:00'),
          previewOccurrence(
            dateOffsetFrom(startDate, 1),
            dateOffsetFrom(startDate, 1),
            '08:00',
            '09:00',
          ),
          previewOccurrence(
            firstRemovedDate,
            firstRemovedDate,
            '10:00',
            '11:00',
          ),
          previewOccurrence(lastRemovedDate, lastRemovedDate, '11:00', '12:00'),
          previewOccurrence(lastDate, lastDate, '08:00', '09:00'),
        ],
        overridesDuringDryRun: [
          {
            scheduleId: 'SCHEDULE_ID',
            occurrenceDate: firstRemovedDate,
            startTime: '10:00',
            endTime: '11:00',
            movedToDate: null,
            skipped: false,
          },
          {
            scheduleId: 'SCHEDULE_ID',
            occurrenceDate: lastRemovedDate,
            startTime: '11:00',
            endTime: '12:00',
            movedToDate: null,
            skipped: false,
          },
        ],
        saveStatus: 200,
        afterSave: [
          previewOccurrence(startDate, startDate, '08:00', '09:00'),
          previewOccurrence(
            dateOffsetFrom(startDate, 1),
            dateOffsetFrom(startDate, 1),
            '08:00',
            '09:00',
          ),
        ],
        overridesAfterSave: [],
      })
    })

    it('updates startDate', async () => {
      const { body: created } = await createSchedule({
        title: 'Routine',
        startTime: '09:00',
        endTime: '10:00',
      })

      const res = await app.request(`/api/schedule/events/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: '2026-03-25' }),
      })
      const body = await jsonBody<ScheduleResponse>(res)

      expect(normalizeScheduleHttpResponse(res.status, body)).toEqual({
        status: 200,
        body: {
          id: 'SCHEDULE_ID',
          title: 'Routine',
          startDate: '2026-03-25',
          endDate: null,
          startTime: '09:00',
          endTime: '10:00',
          recurrence: null,
          context: 'personal',
          color: null,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
      })
    })

    it('changes times and recurrence only from effectiveFrom onward', async () => {
      const { body: created } = await createSchedule({
        title: 'Routine',
        startDate: '2026-03-22',
        startTime: '09:00',
        endTime: '10:00',
        recurrence: { type: 'daily', interval: 1 },
      })

      const patchResponse = await app.request(
        `/api/schedule/events/${created.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            effectiveFrom: '2026-03-24',
            startTime: '18:00',
            endTime: '19:00',
            recurrence: {
              type: 'weekly',
              interval: 1,
              daysOfWeek: [2, 4],
            },
          }),
        },
      )
      const listResponse = await app.request(
        '/api/schedule/events?startDate=2026-03-22&endDate=2026-03-26',
      )

      const snapshot = async () => ({
        patchStatus: patchResponse.status,
        listStatus: listResponse.status,
        blocks: normalizeExpandedBlocks(
          await jsonBody<ExpandedBlock[]>(listResponse),
        ),
      })

      expect(await snapshot()).toEqual({
        patchStatus: 200,
        listStatus: 200,
        blocks: [
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Routine',
            startDate: '2026-03-22',
            start: '2026-03-22T09:00:00',
            end: '2026-03-22T10:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-22',
            overridden: null,
            recurrence: {
              id: 'RECURRENCE_ID',
              type: 'daily',
              interval: 1,
              daysOfWeek: null,
              dayOfMonth: null,
            },
          },
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Routine',
            startDate: '2026-03-22',
            start: '2026-03-23T09:00:00',
            end: '2026-03-23T10:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-23',
            overridden: null,
            recurrence: {
              id: 'RECURRENCE_ID',
              type: 'daily',
              interval: 1,
              daysOfWeek: null,
              dayOfMonth: null,
            },
          },
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Routine',
            startDate: '2026-03-22',
            start: '2026-03-24T18:00:00',
            end: '2026-03-24T19:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-24',
            overridden: null,
            recurrence: {
              id: 'RECURRENCE_ID',
              type: 'weekly',
              interval: 1,
              daysOfWeek: [2, 4],
              dayOfMonth: null,
            },
          },
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Routine',
            startDate: '2026-03-22',
            start: '2026-03-26T18:00:00',
            end: '2026-03-26T19:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-26',
            overridden: null,
            recurrence: {
              id: 'RECURRENCE_ID',
              type: 'weekly',
              interval: 1,
              daysOfWeek: [2, 4],
              dayOfMonth: null,
            },
          },
        ],
      })
    })

    it('replaces all later revisions when updating from an earlier effectiveFrom', async () => {
      const { body: created } = await createSchedule({
        title: 'Routine',
        startDate: '2026-03-22',
        startTime: '09:00',
        endTime: '10:00',
        recurrence: { type: 'daily', interval: 1 },
      })
      const firstRevisionPatch = await app.request(
        `/api/schedule/events/${created.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            effectiveFrom: '2026-03-24',
            startTime: '18:00',
            endTime: '19:00',
            recurrence: {
              type: 'weekly',
              interval: 1,
              daysOfWeek: [2, 4],
            },
          }),
        },
      )
      const obsoleteRevisionPatch = await app.request(
        `/api/schedule/events/${created.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            effectiveFrom: '2026-03-28',
            startTime: '21:00',
            endTime: '22:00',
            recurrence: {
              type: 'weekly',
              interval: 1,
              daysOfWeek: [6],
            },
          }),
        },
      )
      const obsoleteRuleId = (
        await jsonBody<ScheduleResponse>(obsoleteRevisionPatch)
      ).recurrence?.id
      assertDefined(obsoleteRuleId, 'no recurrence rule on obsolete revision')
      const replacementPatch = await app.request(
        `/api/schedule/events/${created.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            effectiveFrom: '2026-03-26',
            startTime: '20:00',
            endTime: '21:00',
            recurrence: {
              type: 'weekly',
              interval: 1,
              daysOfWeek: [4],
            },
          }),
        },
      )
      const listResponse = await app.request(
        '/api/schedule/events?startDate=2026-03-22&endDate=2026-03-29',
      )
      const obsoleteRuleRows = await db
        .select({ id: recurrenceRules.id })
        .from(recurrenceRules)
        .where(eq(recurrenceRules.id, obsoleteRuleId))

      const snapshot = async () => ({
        patchStatuses: [
          firstRevisionPatch.status,
          obsoleteRevisionPatch.status,
          replacementPatch.status,
        ],
        obsoleteRuleIds: obsoleteRuleRows.map(({ id }) => id),
        listStatus: listResponse.status,
        blocks: normalizeExpandedBlocks(
          await jsonBody<ExpandedBlock[]>(listResponse),
        ),
      })

      expect(await snapshot()).toEqual({
        patchStatuses: [200, 200, 200],
        obsoleteRuleIds: [],
        listStatus: 200,
        blocks: [
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Routine',
            startDate: '2026-03-22',
            start: '2026-03-22T09:00:00',
            end: '2026-03-22T10:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-22',
            overridden: null,
            recurrence: {
              id: 'RECURRENCE_ID',
              type: 'daily',
              interval: 1,
              daysOfWeek: null,
              dayOfMonth: null,
            },
          },
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Routine',
            startDate: '2026-03-22',
            start: '2026-03-23T09:00:00',
            end: '2026-03-23T10:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-23',
            overridden: null,
            recurrence: {
              id: 'RECURRENCE_ID',
              type: 'daily',
              interval: 1,
              daysOfWeek: null,
              dayOfMonth: null,
            },
          },
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Routine',
            startDate: '2026-03-22',
            start: '2026-03-24T18:00:00',
            end: '2026-03-24T19:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-24',
            overridden: null,
            recurrence: {
              id: 'RECURRENCE_ID',
              type: 'weekly',
              interval: 1,
              daysOfWeek: [2, 4],
              dayOfMonth: null,
            },
          },
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Routine',
            startDate: '2026-03-22',
            start: '2026-03-26T20:00:00',
            end: '2026-03-26T21:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-26',
            overridden: null,
            recurrence: {
              id: 'RECURRENCE_ID',
              type: 'weekly',
              interval: 1,
              daysOfWeek: [4],
              dayOfMonth: null,
            },
          },
        ],
      })
    })

    it('applies schedule changes to all dates when effectiveFrom is omitted', async () => {
      const { body: created } = await createSchedule({
        title: 'Routine',
        startDate: '2026-03-22',
        startTime: '09:00',
        endTime: '10:00',
        recurrence: { type: 'daily', interval: 1 },
      })
      const patchResponse = await app.request(
        `/api/schedule/events/${created.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startTime: '11:00',
            endTime: '12:00',
            recurrence: {
              type: 'weekly',
              interval: 1,
              daysOfWeek: [1],
            },
          }),
        },
      )
      const listResponse = await app.request(
        '/api/schedule/events?startDate=2026-03-22&endDate=2026-03-24',
      )

      const snapshot = async () => ({
        patchStatus: patchResponse.status,
        listStatus: listResponse.status,
        blocks: normalizeExpandedBlocks(
          await jsonBody<ExpandedBlock[]>(listResponse),
        ),
      })

      expect(await snapshot()).toEqual({
        patchStatus: 200,
        listStatus: 200,
        blocks: [
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Routine',
            startDate: '2026-03-22',
            start: '2026-03-23T11:00:00',
            end: '2026-03-23T12:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-23',
            overridden: null,
            recurrence: {
              id: 'RECURRENCE_ID',
              type: 'weekly',
              interval: 1,
              daysOfWeek: [1],
              dayOfMonth: null,
            },
          },
        ],
      })
    })

    it('deletes recurrence rules when replacing all schedule revisions', async () => {
      const { body: created } = await createSchedule({
        title: 'Routine',
        startDate: '2026-03-22',
        startTime: '09:00',
        endTime: '10:00',
        recurrence: { type: 'daily', interval: 1 },
      })
      const firstRuleId = created.recurrence?.id
      assertDefined(firstRuleId, 'no recurrence rule on created schedule')
      const laterRevisionPatch = await app.request(
        `/api/schedule/events/${created.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            effectiveFrom: '2026-03-24',
            recurrence: { type: 'weekly', interval: 1, daysOfWeek: [2] },
          }),
        },
      )
      const laterRuleId = (await jsonBody<ScheduleResponse>(laterRevisionPatch))
        .recurrence?.id
      assertDefined(laterRuleId, 'no recurrence rule on later revision')
      const replacementPatch = await app.request(
        `/api/schedule/events/${created.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recurrence: null }),
        },
      )
      const recurrenceRuleRows = await db
        .select({ id: recurrenceRules.id })
        .from(recurrenceRules)
        .where(inArray(recurrenceRules.id, [firstRuleId, laterRuleId]))

      const snapshot = () => ({
        patchStatuses: [laterRevisionPatch.status, replacementPatch.status],
        remainingRuleIds: recurrenceRuleRows.map(({ id }) => id),
      })

      expect(snapshot()).toEqual({
        patchStatuses: [200, 200],
        remainingRuleIds: [],
      })
    })

    it('keeps later revisions when the unchanged startDate is patched', async () => {
      const { body: created } = await createSchedule({
        title: 'Routine',
        startDate: '2026-03-22',
        startTime: '09:00',
        endTime: '10:00',
        recurrence: { type: 'daily', interval: 1 },
      })
      const revisionPatchResponse = await app.request(
        `/api/schedule/events/${created.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            effectiveFrom: '2026-03-24',
            startTime: '18:00',
            endTime: '19:00',
            recurrence: {
              type: 'weekly',
              interval: 1,
              daysOfWeek: [2, 4],
            },
          }),
        },
      )
      const metadataPatchResponse = await app.request(
        `/api/schedule/events/${created.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startDate: '2026-03-22',
            title: 'Updated Routine',
          }),
        },
      )
      const listResponse = await app.request(
        '/api/schedule/events?startDate=2026-03-22&endDate=2026-03-26',
      )

      const snapshot = async () => ({
        patchStatuses: [
          revisionPatchResponse.status,
          metadataPatchResponse.status,
        ],
        listStatus: listResponse.status,
        blocks: normalizeExpandedBlocks(
          await jsonBody<ExpandedBlock[]>(listResponse),
        ),
      })

      expect(await snapshot()).toEqual({
        patchStatuses: [200, 200],
        listStatus: 200,
        blocks: [
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Updated Routine',
            startDate: '2026-03-22',
            start: '2026-03-22T09:00:00',
            end: '2026-03-22T10:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-22',
            overridden: null,
            recurrence: {
              id: 'RECURRENCE_ID',
              type: 'daily',
              interval: 1,
              daysOfWeek: null,
              dayOfMonth: null,
            },
          },
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Updated Routine',
            startDate: '2026-03-22',
            start: '2026-03-23T09:00:00',
            end: '2026-03-23T10:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-23',
            overridden: null,
            recurrence: {
              id: 'RECURRENCE_ID',
              type: 'daily',
              interval: 1,
              daysOfWeek: null,
              dayOfMonth: null,
            },
          },
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Updated Routine',
            startDate: '2026-03-22',
            start: '2026-03-24T18:00:00',
            end: '2026-03-24T19:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-24',
            overridden: null,
            recurrence: {
              id: 'RECURRENCE_ID',
              type: 'weekly',
              interval: 1,
              daysOfWeek: [2, 4],
              dayOfMonth: null,
            },
          },
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Updated Routine',
            startDate: '2026-03-22',
            start: '2026-03-26T18:00:00',
            end: '2026-03-26T19:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-26',
            overridden: null,
            recurrence: {
              id: 'RECURRENCE_ID',
              type: 'weekly',
              interval: 1,
              daysOfWeek: [2, 4],
              dayOfMonth: null,
            },
          },
        ],
      })
    })

    it('rejects changing a one-off schedule from a different effective date', async () => {
      const { body: created } = await createSchedule({
        title: 'Single Event',
        startDate: '2026-03-22',
        startTime: '09:00',
        endTime: '10:00',
      })
      const patchResponse = await app.request(
        `/api/schedule/events/${created.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            effectiveFrom: '2026-03-23',
            startTime: '18:00',
            endTime: '19:00',
          }),
        },
      )
      const listResponse = await app.request(
        '/api/schedule/events?startDate=2026-03-22&endDate=2026-03-24',
      )

      const snapshot = async () => ({
        patchStatus: patchResponse.status,
        patchBody: await jsonBody<{ error: string }>(patchResponse),
        listStatus: listResponse.status,
        blocks: normalizeExpandedBlocks(
          await jsonBody<ExpandedBlock[]>(listResponse),
        ),
      })

      expect(await snapshot()).toEqual({
        patchStatus: 422,
        patchBody: {
          error: 'effectiveFrom must match the date of a one-off schedule',
        },
        listStatus: 200,
        blocks: [
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Single Event',
            startDate: '2026-03-22',
            start: '2026-03-22T09:00:00',
            end: '2026-03-22T10:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-22',
            overridden: null,
            recurrence: null,
          },
        ],
      })
    })

    it('allows global metadata changes when effectiveFrom is provided for a one-off schedule', async () => {
      const { body: created } = await createSchedule({
        title: 'Single Event',
        startDate: '2026-03-22',
        startTime: '09:00',
        endTime: '10:00',
      })
      const patchResponse = await app.request(
        `/api/schedule/events/${created.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            effectiveFrom: '2026-03-23',
            title: 'Updated Event',
          }),
        },
      )
      const listResponse = await app.request(
        '/api/schedule/events?startDate=2026-03-22&endDate=2026-03-24',
      )

      const snapshot = async () => ({
        patchStatus: patchResponse.status,
        response: normalizeScheduleResponse(
          await jsonBody<ScheduleResponse>(patchResponse),
        ),
        listStatus: listResponse.status,
        blocks: normalizeExpandedBlocks(
          await jsonBody<ExpandedBlock[]>(listResponse),
        ),
      })

      expect(await snapshot()).toEqual({
        patchStatus: 200,
        response: {
          id: 'SCHEDULE_ID',
          title: 'Updated Event',
          startDate: '2026-03-22',
          endDate: null,
          startTime: '09:00',
          endTime: '10:00',
          recurrence: null,
          context: 'personal',
          color: null,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
        listStatus: 200,
        blocks: [
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Updated Event',
            startDate: '2026-03-22',
            start: '2026-03-22T09:00:00',
            end: '2026-03-22T10:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-22',
            overridden: null,
            recurrence: null,
          },
        ],
      })
    })

    it('adds recurrence from a later date while preserving a one-off occurrence', async () => {
      const { body: created } = await createSchedule({
        title: 'Single Event',
        startDate: '2026-03-22',
        startTime: '09:00',
        endTime: '10:00',
      })
      const patchResponse = await app.request(
        `/api/schedule/events/${created.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            effectiveFrom: '2026-03-24',
            startTime: '18:00',
            endTime: '19:00',
            recurrence: { type: 'daily', interval: 1 },
          }),
        },
      )
      const listResponse = await app.request(
        '/api/schedule/events?startDate=2026-03-22&endDate=2026-03-26',
      )

      const snapshot = async () => ({
        patchStatus: patchResponse.status,
        listStatus: listResponse.status,
        blocks: normalizeExpandedBlocks(
          await jsonBody<ExpandedBlock[]>(listResponse),
        ),
      })

      expect(await snapshot()).toEqual({
        patchStatus: 200,
        listStatus: 200,
        blocks: [
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Single Event',
            startDate: '2026-03-22',
            start: '2026-03-22T09:00:00',
            end: '2026-03-22T10:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-22',
            overridden: null,
            recurrence: null,
          },
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Single Event',
            startDate: '2026-03-22',
            start: '2026-03-24T18:00:00',
            end: '2026-03-24T19:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-24',
            overridden: null,
            recurrence: {
              id: 'RECURRENCE_ID',
              type: 'daily',
              interval: 1,
              daysOfWeek: null,
              dayOfMonth: null,
            },
          },
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Single Event',
            startDate: '2026-03-22',
            start: '2026-03-25T18:00:00',
            end: '2026-03-25T19:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-25',
            overridden: null,
            recurrence: {
              id: 'RECURRENCE_ID',
              type: 'daily',
              interval: 1,
              daysOfWeek: null,
              dayOfMonth: null,
            },
          },
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Single Event',
            startDate: '2026-03-22',
            start: '2026-03-26T18:00:00',
            end: '2026-03-26T19:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-26',
            overridden: null,
            recurrence: {
              id: 'RECURRENCE_ID',
              type: 'daily',
              interval: 1,
              daysOfWeek: null,
              dayOfMonth: null,
            },
          },
        ],
      })
    })

    it('adds a one-off occurrence when recurrence is explicitly null', async () => {
      const { body: created } = await createSchedule({
        title: 'Single Event',
        startDate: '2026-03-22',
        startTime: '09:00',
        endTime: '10:00',
      })
      const patchResponse = await app.request(
        `/api/schedule/events/${created.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            effectiveFrom: '2026-03-23',
            startTime: '18:00',
            endTime: '19:00',
            recurrence: null,
          }),
        },
      )
      const listResponse = await app.request(
        '/api/schedule/events?startDate=2026-03-22&endDate=2026-03-24',
      )

      const snapshot = async () => ({
        patchStatus: patchResponse.status,
        listStatus: listResponse.status,
        blocks: normalizeExpandedBlocks(
          await jsonBody<ExpandedBlock[]>(listResponse),
        ),
      })

      expect(await snapshot()).toEqual({
        patchStatus: 200,
        listStatus: 200,
        blocks: [
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Single Event',
            startDate: '2026-03-22',
            start: '2026-03-22T09:00:00',
            end: '2026-03-22T10:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-22',
            overridden: null,
            recurrence: null,
          },
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Single Event',
            startDate: '2026-03-22',
            start: '2026-03-23T18:00:00',
            end: '2026-03-23T19:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-23',
            overridden: null,
            recurrence: null,
          },
        ],
      })
    })

    it('shows only the effective date after recurrence is removed', async () => {
      const { body: created } = await createSchedule({
        title: 'Routine',
        startDate: '2026-03-22',
        startTime: '09:00',
        endTime: '10:00',
        recurrence: { type: 'daily', interval: 1 },
      })
      const patchResponse = await app.request(
        `/api/schedule/events/${created.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            effectiveFrom: '2026-03-24',
            recurrence: null,
          }),
        },
      )
      const listResponse = await app.request(
        '/api/schedule/events?startDate=2026-03-22&endDate=2026-03-26',
      )

      const snapshot = async () => ({
        patchStatus: patchResponse.status,
        listStatus: listResponse.status,
        blocks: normalizeExpandedBlocks(
          await jsonBody<ExpandedBlock[]>(listResponse),
        ),
      })

      expect(await snapshot()).toEqual({
        patchStatus: 200,
        listStatus: 200,
        blocks: [
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Routine',
            startDate: '2026-03-22',
            start: '2026-03-22T09:00:00',
            end: '2026-03-22T10:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-22',
            overridden: null,
            recurrence: {
              id: 'RECURRENCE_ID',
              type: 'daily',
              interval: 1,
              daysOfWeek: null,
              dayOfMonth: null,
            },
          },
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Routine',
            startDate: '2026-03-22',
            start: '2026-03-23T09:00:00',
            end: '2026-03-23T10:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-23',
            overridden: null,
            recurrence: {
              id: 'RECURRENCE_ID',
              type: 'daily',
              interval: 1,
              daysOfWeek: null,
              dayOfMonth: null,
            },
          },
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Routine',
            startDate: '2026-03-22',
            start: '2026-03-24T09:00:00',
            end: '2026-03-24T10:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-24',
            overridden: null,
            recurrence: null,
          },
        ],
      })
    })

    it('removes only exceptions whose original dates stop recurring', async () => {
      const { body: created } = await createSchedule({
        title: 'Routine',
        startDate: '2026-03-22',
        startTime: '09:00',
        endTime: '10:00',
        recurrence: { type: 'daily', interval: 1 },
      })
      const retainedOverride = await putScheduleOverride(
        created.id,
        '2026-03-24',
        { startTime: '08:30', endTime: '09:30' },
      )
      const removedOverride = await putScheduleOverride(
        created.id,
        '2026-03-25',
        { date: '2026-03-26', startTime: '08:30', endTime: '09:30' },
      )
      const firstPatch = await app.request(
        `/api/schedule/events/${created.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            effectiveFrom: '2026-03-24',
            startTime: '18:00',
            endTime: '19:00',
            recurrence: {
              type: 'weekly',
              interval: 1,
              daysOfWeek: [2],
            },
          }),
        },
      )
      const secondPatch = await app.request(
        `/api/schedule/events/${created.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            effectiveFrom: '2026-03-25',
            recurrence: { type: 'daily', interval: 1 },
          }),
        },
      )
      const listResponse = await app.request(
        '/api/schedule/events?startDate=2026-03-24&endDate=2026-03-26',
      )

      const snapshot = async () => ({
        overrideStatuses: [retainedOverride.status, removedOverride.status],
        patchStatuses: [firstPatch.status, secondPatch.status],
        listStatus: listResponse.status,
        blocks: normalizeExpandedBlocks(
          await jsonBody<ExpandedBlock[]>(listResponse),
        ),
      })

      expect(await snapshot()).toEqual({
        overrideStatuses: [200, 200],
        patchStatuses: [200, 200],
        listStatus: 200,
        blocks: [
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Routine',
            startDate: '2026-03-22',
            start: '2026-03-24T08:30:00',
            end: '2026-03-24T09:30:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-24',
            overridden: 'time',
            recurrence: {
              id: 'RECURRENCE_ID',
              type: 'weekly',
              interval: 1,
              daysOfWeek: [2],
              dayOfMonth: null,
            },
          },
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Routine',
            startDate: '2026-03-22',
            start: '2026-03-25T18:00:00',
            end: '2026-03-25T19:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-25',
            overridden: null,
            recurrence: {
              id: 'RECURRENCE_ID',
              type: 'daily',
              interval: 1,
              daysOfWeek: null,
              dayOfMonth: null,
            },
          },
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Routine',
            startDate: '2026-03-22',
            start: '2026-03-26T18:00:00',
            end: '2026-03-26T19:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-26',
            overridden: null,
            recurrence: {
              id: 'RECURRENCE_ID',
              type: 'daily',
              interval: 1,
              daysOfWeek: null,
              dayOfMonth: null,
            },
          },
        ],
      })
    })

    it('deletes overrides after endDate so they do not return when extended', async () => {
      const { body: created } = await createSchedule({
        title: 'Routine',
        startDate: '2026-03-22',
        startTime: '09:00',
        endTime: '10:00',
        recurrence: { type: 'daily', interval: 1 },
      })
      const overrideResponse = await putScheduleOverride(
        created.id,
        '2026-03-24',
        { startTime: '08:30', endTime: '09:30' },
      )
      const shortenResponse = await app.request(
        `/api/schedule/events/${created.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endDate: '2026-03-23' }),
        },
      )
      const extendResponse = await app.request(
        `/api/schedule/events/${created.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endDate: null }),
        },
      )
      const listResponse = await app.request(
        '/api/schedule/events?startDate=2026-03-24&endDate=2026-03-24',
      )
      const remainingOverrides = await db
        .select({ occurrenceDate: scheduleOverrides.occurrenceDate })
        .from(scheduleOverrides)
        .where(eq(scheduleOverrides.scheduleId, created.id))

      const snapshot = async () => ({
        statuses: [
          overrideResponse.status,
          shortenResponse.status,
          extendResponse.status,
        ],
        endDates: [
          (await jsonBody<ScheduleResponse>(shortenResponse)).endDate,
          (await jsonBody<ScheduleResponse>(extendResponse)).endDate,
        ],
        remainingOverrides,
        listStatus: listResponse.status,
        blocks: normalizeExpandedBlocks(
          await jsonBody<ExpandedBlock[]>(listResponse),
        ),
      })

      expect(await snapshot()).toEqual({
        statuses: [200, 200, 200],
        endDates: ['2026-03-23', null],
        remainingOverrides: [],
        listStatus: 200,
        blocks: [
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Routine',
            startDate: '2026-03-22',
            start: '2026-03-24T09:00:00',
            end: '2026-03-24T10:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-24',
            overridden: null,
            recurrence: {
              id: 'RECURRENCE_ID',
              type: 'daily',
              interval: 1,
              daysOfWeek: null,
              dayOfMonth: null,
            },
          },
        ],
      })
    })

    it('ends a schedule inclusively on endDate', async () => {
      const { body: created } = await createSchedule({
        title: 'Routine',
        startDate: '2026-03-22',
        startTime: '09:00',
        endTime: '10:00',
        recurrence: { type: 'daily', interval: 1 },
      })
      const patchResponse = await app.request(
        `/api/schedule/events/${created.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endDate: '2026-03-23' }),
        },
      )
      const listResponse = await app.request(
        '/api/schedule/events?startDate=2026-03-22&endDate=2026-03-24',
      )

      const snapshot = async () => ({
        patchStatus: patchResponse.status,
        endDate: (await jsonBody<ScheduleResponse>(patchResponse)).endDate,
        listStatus: listResponse.status,
        blocks: normalizeExpandedBlocks(
          await jsonBody<ExpandedBlock[]>(listResponse),
        ),
      })

      expect(await snapshot()).toEqual({
        patchStatus: 200,
        endDate: '2026-03-23',
        listStatus: 200,
        blocks: [
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Routine',
            startDate: '2026-03-22',
            start: '2026-03-22T09:00:00',
            end: '2026-03-22T10:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-22',
            overridden: null,
            recurrence: {
              id: 'RECURRENCE_ID',
              type: 'daily',
              interval: 1,
              daysOfWeek: null,
              dayOfMonth: null,
            },
          },
          {
            scheduleId: 'SCHEDULE_ID',
            title: 'Routine',
            startDate: '2026-03-22',
            start: '2026-03-23T09:00:00',
            end: '2026-03-23T10:00:00',
            context: 'personal',
            color: null,
            occurrenceDate: '2026-03-23',
            overridden: null,
            recurrence: {
              id: 'RECURRENCE_ID',
              type: 'daily',
              interval: 1,
              daysOfWeek: null,
              dayOfMonth: null,
            },
          },
        ],
      })
    })

    it('rejects endDate before the first revision date', async () => {
      const { body: created } = await createSchedule({
        title: 'Routine',
        startDate: '2026-03-22',
        startTime: '09:00',
        endTime: '10:00',
      })
      const response = await app.request(`/api/schedule/events/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endDate: '2026-03-21' }),
      })

      const snapshot = async () => ({
        status: response.status,
        body: await response.json(),
      })

      expect(await snapshot()).toEqual({
        status: 422,
        body: {
          error: 'endDate must be on or after the schedule start date',
        },
      })
    })

    it('updates schedule title', async () => {
      const { body: created } = await createSchedule({
        title: 'Sleep',
        startTime: '23:00',
        endTime: '07:00',
      })

      const res = await app.request(`/api/schedule/events/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Deep Sleep' }),
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<ScheduleResponse>(res)
      expect(body.title).toBe('Deep Sleep')
    })

    it('adds recurrence to a schedule', async () => {
      const { body: created } = await createSchedule({
        title: 'Exercise',
        startTime: '18:00',
        endTime: '19:00',
      })

      const res = await app.request(`/api/schedule/events/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recurrence: {
            type: 'weekly',
            interval: 1,
            daysOfWeek: [1, 3, 5],
          },
        }),
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<ScheduleResponse>(res)
      assertDefined(body.recurrence)
      expect(body.recurrence.type).toBe('weekly')
    })

    it('removes recurrence from a schedule', async () => {
      const { body: created } = await createSchedule({
        title: 'Gym',
        startTime: '18:00',
        endTime: '19:00',
        recurrence: { type: 'daily', interval: 1 },
      })

      const res = await app.request(`/api/schedule/events/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recurrence: null }),
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<ScheduleResponse>(res)
      expect(body.recurrence).toBeNull()
    })

    it('returns 404 for non-existent schedule', async () => {
      const res = await app.request(`/api/schedule/events/${TEST_UUID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Nope' }),
      })
      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/schedule/events/:id', () => {
    it('deletes a schedule', async () => {
      const { body: created } = await createSchedule({
        title: 'To Delete',
        startTime: '09:00',
        endTime: '10:00',
      })

      const res = await app.request(`/api/schedule/events/${created.id}`, {
        method: 'DELETE',
      })
      expect(res.status).toBe(204)

      // Verify it's gone
      const getRes = await app.request(
        '/api/schedule/events?startDate=2026-03-22&endDate=2026-03-22',
      )
      const blocks = await jsonBody<ExpandedBlock[]>(getRes)
      expect(blocks).toHaveLength(0)
    })

    it('deletes associated recurrence rule', async () => {
      const { body: created } = await createSchedule({
        title: 'Gym',
        startTime: '18:00',
        endTime: '19:00',
        recurrence: { type: 'daily', interval: 1 },
      })
      const recurrenceRuleId = created.recurrence?.id
      assertDefined(recurrenceRuleId, 'no recurrence rule on created schedule')

      const res = await app.request(`/api/schedule/events/${created.id}`, {
        method: 'DELETE',
      })
      const recurrenceRuleRows = await db
        .select({ id: recurrenceRules.id })
        .from(recurrenceRules)
        .where(eq(recurrenceRules.id, recurrenceRuleId))

      const snapshot = () => ({
        status: res.status,
        recurrenceRuleIds: recurrenceRuleRows.map(({ id }) => id),
      })

      expect(snapshot()).toEqual({ status: 204, recurrenceRuleIds: [] })
    })

    it('returns 404 for non-existent schedule', async () => {
      const res = await app.request(`/api/schedule/events/${TEST_UUID}`, {
        method: 'DELETE',
      })
      expect(res.status).toBe(404)
    })
  })
})

describe('schedule overrides API', () => {
  it('previews a moved occurrence and leaves the override unchanged until saved', async () => {
    const occurrenceDate = dateAtOffset(5)
    const destinationDate = dateOffsetFrom(occurrenceDate, 2)
    const { body: schedule } = await createSchedule({
      title: 'Review block',
      startDate: occurrenceDate,
      startTime: '08:30',
      endTime: '09:30',
      recurrence: { type: 'daily', interval: 1 },
    })
    await putScheduleOverride(schedule.id, occurrenceDate, {
      startTime: '07:30',
      endTime: '08:30',
    })

    const beforeSave = await listScheduleEvents(occurrenceDate, destinationDate)
    const dryRunInput = {
      date: destinationDate,
      startTime: '10:00',
      endTime: '11:00',
      dryRun: true,
    }
    const dryRunResponse = await putScheduleOverride(
      schedule.id,
      occurrenceDate,
      dryRunInput,
    )
    const preview = await jsonBody<ScheduleChangePreview>(dryRunResponse)
    const overridesDuringDryRun = await listScheduleOverrides(schedule.id)
    const saveResponse = await putScheduleOverride(
      schedule.id,
      occurrenceDate,
      {
        date: destinationDate,
        startTime: '10:00',
        endTime: '11:00',
      },
    )
    const afterSave = await listScheduleEvents(occurrenceDate, destinationDate)
    const overridesAfterSave = await listScheduleOverrides(schedule.id)

    const snapshot = () => ({
      dryRunStatus: dryRunResponse.status,
      preview: normalizePreview(preview),
      beforeSave: beforeSave.occurrences.filter(
        (occurrence) => occurrence.originalDate === occurrenceDate,
      ),
      overridesDuringDryRun: normalizeOverrideRows(overridesDuringDryRun),
      saveStatus: saveResponse.status,
      afterSave: afterSave.occurrences.filter(
        (occurrence) => occurrence.originalDate === occurrenceDate,
      ),
      overridesAfterSave: normalizeOverrideRows(overridesAfterSave),
    })
    expect(snapshot()).toEqual({
      dryRunStatus: 200,
      preview: {
        range: { startDate: occurrenceDate, endDate: destinationDate },
        changes: [
          {
            before: previewOccurrence(
              occurrenceDate,
              occurrenceDate,
              '07:30',
              '08:30',
            ),
            after: previewOccurrence(
              destinationDate,
              occurrenceDate,
              '10:00',
              '11:00',
            ),
          },
        ],
        deletedOverrides: [],
      },
      beforeSave: [
        previewOccurrence(occurrenceDate, occurrenceDate, '07:30', '08:30'),
      ],
      overridesDuringDryRun: [
        {
          scheduleId: 'SCHEDULE_ID',
          occurrenceDate,
          startTime: '07:30',
          endTime: '08:30',
          movedToDate: null,
          skipped: false,
        },
      ],
      saveStatus: 200,
      afterSave: [
        previewOccurrence(destinationDate, occurrenceDate, '10:00', '11:00'),
      ],
      overridesAfterSave: [
        {
          scheduleId: 'SCHEDULE_ID',
          occurrenceDate,
          startTime: '10:00',
          endTime: '11:00',
          movedToDate: destinationDate,
          skipped: false,
        },
      ],
    })
  })

  it('previews skipping an occurrence without saving it', async () => {
    const occurrenceDate = dateAtOffset(6)
    const { body: schedule } = await createSchedule({
      title: 'Review block',
      startDate: occurrenceDate,
      startTime: '08:30',
      endTime: '09:30',
      recurrence: { type: 'daily', interval: 1 },
    })

    const dryRunResponse = await putScheduleOverride(
      schedule.id,
      occurrenceDate,
      { skipped: true, dryRun: true },
    )
    const preview = await jsonBody<ScheduleChangePreview>(dryRunResponse)
    const overridesDuringDryRun = await listScheduleOverrides(schedule.id)
    const saveResponse = await putScheduleOverride(
      schedule.id,
      occurrenceDate,
      {
        skipped: true,
      },
    )
    const actualEvents = await listScheduleEvents(
      occurrenceDate,
      occurrenceDate,
    )
    const overridesAfterSave = await listScheduleOverrides(schedule.id)

    const snapshot = () => ({
      dryRunStatus: dryRunResponse.status,
      preview: normalizePreview(preview),
      overridesDuringDryRun: normalizeOverrideRows(overridesDuringDryRun),
      saveStatus: saveResponse.status,
      actualEvents: actualEvents.occurrences,
      overridesAfterSave: normalizeOverrideRows(overridesAfterSave),
    })
    expect(snapshot()).toEqual({
      dryRunStatus: 200,
      preview: {
        range: { startDate: occurrenceDate, endDate: occurrenceDate },
        changes: [
          {
            before: previewOccurrence(
              occurrenceDate,
              occurrenceDate,
              '08:30',
              '09:30',
            ),
            after: previewOccurrence(
              occurrenceDate,
              occurrenceDate,
              '08:30',
              '09:30',
              true,
            ),
          },
        ],
        deletedOverrides: [],
      },
      overridesDuringDryRun: [],
      saveStatus: 200,
      actualEvents: [],
      overridesAfterSave: [
        {
          scheduleId: 'SCHEDULE_ID',
          occurrenceDate,
          startTime: null,
          endTime: null,
          movedToDate: null,
          skipped: true,
        },
      ],
    })
  })

  it('returns the destination date when setting a move override', async () => {
    const { body: schedule } = await createSchedule({
      title: 'Routine',
      startDate: '2034-08-17',
      startTime: '09:00',
      endTime: '10:00',
      recurrence: { type: 'daily', interval: 1 },
    })
    const sourceDate = '2034-08-17'
    const destinationDate = '2034-08-18'
    const setResponse = await putScheduleOverride(schedule.id, sourceDate, {
      date: destinationDate,
      startTime: '09:00',
      endTime: '10:00',
    })
    const setBody = await jsonBody<{
      scheduleId: string
      occurrenceDate: string
      startTime: string | null
      endTime: string | null
      movedToDate: string | null
      skipped: boolean
    }>(setResponse)

    const setSnapshot = () => ({ status: setResponse.status, body: setBody })
    expect(setSnapshot()).toEqual({
      status: 200,
      body: {
        scheduleId: schedule.id,
        occurrenceDate: sourceDate,
        startTime: '09:00',
        endTime: '10:00',
        movedToDate: destinationDate,
        skipped: false,
      },
    })
  })

  it('shows moved and natural occurrences in the requested date range', async () => {
    const { body: schedule } = await createSchedule({
      title: 'Routine',
      startDate: '2034-08-17',
      startTime: '09:00',
      endTime: '10:00',
      recurrence: { type: 'daily', interval: 1 },
    })
    await putScheduleOverride(schedule.id, '2034-08-17', {
      date: '2034-08-18',
      startTime: '09:00',
      endTime: '10:00',
    })
    const response = await app.request(
      '/api/schedule/events?startDate=2034-08-17&endDate=2034-08-19',
    )

    expect(
      normalizeExpandedBlocks(await jsonBody<ExpandedBlock[]>(response)),
    ).toEqual([
      expectedDailyOccurrence({
        occurrenceDate: '2034-08-18',
        start: '2034-08-18T09:00:00',
        end: '2034-08-18T10:00:00',
        overridden: null,
      }),
      expectedDailyOccurrence({
        occurrenceDate: '2034-08-17',
        start: '2034-08-18T09:00:00',
        end: '2034-08-18T10:00:00',
        overridden: 'moved',
      }),
      expectedDailyOccurrence({
        occurrenceDate: '2034-08-19',
        start: '2034-08-19T09:00:00',
        end: '2034-08-19T10:00:00',
        overridden: null,
      }),
    ])
  })

  it('includes the moved occurrence in a destination-only date range', async () => {
    const { body: schedule } = await createSchedule({
      title: 'Routine',
      startDate: '2034-08-17',
      startTime: '09:00',
      endTime: '10:00',
      recurrence: { type: 'daily', interval: 1 },
    })
    await putScheduleOverride(schedule.id, '2034-08-17', {
      date: '2034-08-18',
      startTime: '09:00',
      endTime: '10:00',
    })
    const response = await app.request(
      '/api/schedule/events?startDate=2034-08-18&endDate=2034-08-18',
    )

    expect(
      normalizeExpandedBlocks(await jsonBody<ExpandedBlock[]>(response)),
    ).toEqual([
      expectedDailyOccurrence({
        occurrenceDate: '2034-08-18',
        start: '2034-08-18T09:00:00',
        end: '2034-08-18T10:00:00',
        overridden: null,
      }),
      expectedDailyOccurrence({
        occurrenceDate: '2034-08-17',
        start: '2034-08-18T09:00:00',
        end: '2034-08-18T10:00:00',
        overridden: 'moved',
      }),
    ])
  })

  it('restores the original occurrence after clearing a move', async () => {
    const { body: schedule } = await createSchedule({
      title: 'Routine',
      startDate: '2034-08-17',
      startTime: '09:00',
      endTime: '10:00',
      recurrence: { type: 'daily', interval: 1 },
    })
    await putScheduleOverride(schedule.id, '2034-08-17', {
      date: '2034-08-18',
      startTime: '09:00',
      endTime: '10:00',
    })
    const clearResponse = await app.request(
      `/api/schedule/events/${schedule.id}/overrides/2034-08-17`,
      { method: 'DELETE' },
    )
    const response = await app.request(
      '/api/schedule/events?startDate=2034-08-17&endDate=2034-08-19',
    )

    const snapshot = async () => ({
      clearStatus: clearResponse.status,
      blocks: normalizeExpandedBlocks(
        await jsonBody<ExpandedBlock[]>(response),
      ),
    })
    expect(await snapshot()).toEqual({
      clearStatus: 204,
      blocks: [
        expectedDailyOccurrence({
          occurrenceDate: '2034-08-17',
          start: '2034-08-17T09:00:00',
          end: '2034-08-17T10:00:00',
          overridden: null,
        }),
        expectedDailyOccurrence({
          occurrenceDate: '2034-08-18',
          start: '2034-08-18T09:00:00',
          end: '2034-08-18T10:00:00',
          overridden: null,
        }),
        expectedDailyOccurrence({
          occurrenceDate: '2034-08-19',
          start: '2034-08-19T09:00:00',
          end: '2034-08-19T10:00:00',
          overridden: null,
        }),
      ],
    })
  })

  it('keeps a moved cross-midnight occurrence on its destination dates', async () => {
    const { body: schedule } = await createSchedule({
      title: 'Overnight Routine',
      startDate: '2034-08-17',
      startTime: '23:00',
      endTime: '07:00',
    })
    await putScheduleOverride(schedule.id, '2034-08-17', {
      date: '2034-08-20',
      startTime: '23:00',
      endTime: '07:00',
    })
    const destinationResponse = await app.request(
      '/api/schedule/events?startDate=2034-08-20&endDate=2034-08-20',
    )
    const continuationResponse = await app.request(
      '/api/schedule/events?startDate=2034-08-21&endDate=2034-08-21',
    )

    const destinationBlocks = normalizeExpandedBlocks(
      await jsonBody<ExpandedBlock[]>(destinationResponse),
    )
    const continuationBlocks = normalizeExpandedBlocks(
      await jsonBody<ExpandedBlock[]>(continuationResponse),
    )
    const expandedBlocks = () => [destinationBlocks, continuationBlocks]
    expect(expandedBlocks()).toEqual([
      [
        {
          scheduleId: 'SCHEDULE_ID',
          title: 'Overnight Routine',
          startDate: '2034-08-17',
          start: '2034-08-20T23:00:00',
          end: '2034-08-21T00:00:00',
          context: 'personal',
          color: null,
          occurrenceDate: '2034-08-17',
          overridden: 'moved',
          recurrence: null,
        },
      ],
      [
        {
          scheduleId: 'SCHEDULE_ID',
          title: 'Overnight Routine',
          startDate: '2034-08-17',
          start: '2034-08-21T00:00:00',
          end: '2034-08-21T07:00:00',
          context: 'personal',
          color: null,
          occurrenceDate: '2034-08-17',
          overridden: 'moved',
          recurrence: null,
        },
      ],
    ])
  })

  it('changes one occurrence in the expanded schedule', async () => {
    const { body: schedule } = await createSchedule({
      title: 'Routine',
      startTime: '09:00',
      endTime: '10:00',
    })
    await putScheduleOverride(schedule.id, '2026-03-22', { skipped: true })
    await putScheduleOverride(schedule.id, '2026-03-22', {
      startTime: '08:30',
      endTime: '09:45',
    })
    const response = await app.request(
      '/api/schedule/events?startDate=2026-03-22&endDate=2026-03-22',
    )
    expect(await jsonBody<ExpandedBlock[]>(response)).toEqual([
      {
        scheduleId: schedule.id,
        title: 'Routine',
        startDate: '2026-03-22',
        start: '2026-03-22T08:30:00',
        end: '2026-03-22T09:45:00',
        context: 'personal',
        color: null,
        occurrenceDate: '2026-03-22',
        overridden: 'time',
        recurrence: null,
      },
    ])
  })

  it('clears an override and restores the default time', async () => {
    const { body: schedule } = await createSchedule({
      title: 'Routine',
      startTime: '09:00',
      endTime: '10:00',
    })
    const url = `/api/schedule/events/${schedule.id}/overrides/2026-03-22`
    await putScheduleOverride(schedule.id, '2026-03-22', {
      startTime: '08:30',
      endTime: '09:45',
    })
    await app.request(url, { method: 'DELETE' })

    const response = await app.request(
      '/api/schedule/events?startDate=2026-03-22&endDate=2026-03-22',
    )
    expect(await jsonBody<ExpandedBlock[]>(response)).toEqual([
      {
        scheduleId: schedule.id,
        title: 'Routine',
        startDate: '2026-03-22',
        start: '2026-03-22T09:00:00',
        end: '2026-03-22T10:00:00',
        context: 'personal',
        color: null,
        occurrenceDate: '2026-03-22',
        overridden: null,
        recurrence: null,
      },
    ])
  })

  it('skips an occurrence without changing other dates', async () => {
    const { body: schedule } = await createSchedule({
      title: 'Routine',
      startTime: '09:00',
      endTime: '10:00',
      recurrence: { type: 'daily', interval: 1 },
    })
    await putScheduleOverride(schedule.id, '2026-03-22', { skipped: true })
    const response = await app.request(
      '/api/schedule/events?startDate=2026-03-22&endDate=2026-03-23',
    )

    expect(
      normalizeExpandedBlocks(await jsonBody<ExpandedBlock[]>(response)),
    ).toEqual([
      {
        scheduleId: 'SCHEDULE_ID',
        title: 'Routine',
        startDate: '2026-03-22',
        start: '2026-03-23T09:00:00',
        end: '2026-03-23T10:00:00',
        context: 'personal',
        color: null,
        occurrenceDate: '2026-03-23',
        overridden: null,
        recurrence: {
          id: 'RECURRENCE_ID',
          type: 'daily',
          interval: 1,
          daysOfWeek: null,
          dayOfMonth: null,
        },
      },
    ])
  })

  it('uses the start date override for a cross-midnight continuation', async () => {
    const { body: schedule } = await createSchedule({
      title: 'Overnight Routine',
      startTime: '23:00',
      endTime: '07:00',
    })
    await putScheduleOverride(schedule.id, '2026-03-22', {
      startTime: '22:30',
      endTime: '08:00',
    })
    const nextDateResponse = await app.request(
      '/api/schedule/events?startDate=2026-03-23&endDate=2026-03-23',
    )

    expect(
      normalizeExpandedBlocks(
        await jsonBody<ExpandedBlock[]>(nextDateResponse),
      ),
    ).toEqual([
      {
        scheduleId: 'SCHEDULE_ID',
        title: 'Overnight Routine',
        startDate: '2026-03-22',
        start: '2026-03-23T00:00:00',
        end: '2026-03-23T08:00:00',
        context: 'personal',
        color: null,
        occurrenceDate: '2026-03-22',
        overridden: 'time',
        recurrence: null,
      },
    ])
  })

  it.each([
    {
      name: 'an incomplete time range',
      body: { startTime: '08:30' },
      issues: [
        {
          code: 'invalid_union',
          errors: [
            [
              {
                code: 'invalid_value',
                values: [true],
                path: ['skipped'],
                message: 'Invalid input: expected true',
              },
              {
                code: 'unrecognized_keys',
                keys: ['startTime'],
                path: [],
                message: 'Unrecognized key: "startTime"',
              },
            ],
            [
              {
                expected: 'string',
                code: 'invalid_type',
                path: ['endTime'],
                message: 'Invalid input: expected string, received undefined',
              },
            ],
          ],
          path: [],
          message: 'Invalid input',
        },
      ],
    },
    {
      name: 'a destination date when skipping an occurrence',
      body: { skipped: true, date: '2026-03-23' },
      issues: [
        {
          code: 'invalid_union',
          errors: [
            [
              {
                code: 'unrecognized_keys',
                keys: ['date'],
                path: [],
                message: 'Unrecognized key: "date"',
              },
            ],
            [
              {
                expected: 'string',
                code: 'invalid_type',
                path: ['startTime'],
                message: 'Invalid input: expected string, received undefined',
              },
              {
                expected: 'string',
                code: 'invalid_type',
                path: ['endTime'],
                message: 'Invalid input: expected string, received undefined',
              },
              {
                code: 'invalid_value',
                values: [false],
                path: ['skipped'],
                message: 'Invalid input: expected false',
              },
            ],
          ],
          path: [],
          message: 'Invalid input',
        },
      ],
    },
    {
      name: 'a time outside the 24-hour clock',
      body: { startTime: '24:00', endTime: '09:45' },
      issues: [
        {
          origin: 'string',
          code: 'invalid_format',
          format: 'regex',
          pattern: '/^(?:[01]\\d|2[0-3]):[0-5]\\d$/',
          path: ['startTime'],
          message:
            'Invalid string: must match pattern /^(?:[01]\\d|2[0-3]):[0-5]\\d$/',
        },
      ],
    },
  ])('rejects $name', async ({ body, issues }) => {
    const { body: schedule } = await createSchedule({
      title: 'Routine',
      startTime: '09:00',
      endTime: '10:00',
      recurrence: { type: 'daily', interval: 1 },
    })
    const response = await putScheduleOverride(schedule.id, '2026-03-22', body)

    expect(await normalizeValidationResponse(response)).toEqual({
      status: 400,
      body: {
        success: false,
        error: { name: 'ZodError', issues },
      },
    })
  })

  it('rejects a date that does not match the recurrence rule', async () => {
    const { body: schedule } = await createSchedule({
      title: 'Routine',
      startTime: '09:00',
      endTime: '10:00',
      recurrence: {
        type: 'weekly',
        interval: 1,
        daysOfWeek: [1],
      },
    })
    const response = await putScheduleOverride(schedule.id, '2026-03-24', {
      startTime: '08:00',
      endTime: '09:00',
    })

    expect(response.status).toBe(422)
  })

  it('accepts overrides only on the occurrence date for a one-off schedule', async () => {
    const { body: schedule } = await createSchedule({
      title: 'Routine',
      startTime: '09:00',
      endTime: '10:00',
    })

    const responses = await Promise.all(
      ['2026-03-21', '2026-03-23'].map((date) =>
        putScheduleOverride(schedule.id, date, { skipped: true }),
      ),
    )

    expect(responses.map((response) => response.status)).toEqual([422, 422])
  })

  it('rejects a matching recurrence date before startDate', async () => {
    const { body: schedule } = await createSchedule({
      title: 'Weekly Routine',
      startDate: '2026-03-24',
      startTime: '09:00',
      endTime: '10:00',
      recurrence: {
        type: 'weekly',
        interval: 1,
        daysOfWeek: [1],
      },
    })

    const response = await putScheduleOverride(schedule.id, '2026-03-23', {
      skipped: true,
    })

    expect(response.status).toBe(422)
  })

  it('returns 404 for an unknown schedule', async () => {
    const response = await putScheduleOverride(TEST_UUID, '2026-03-22', {
      skipped: true,
    })

    expect(response.status).toBe(404)
  })
})
