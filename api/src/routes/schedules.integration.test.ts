import { afterEach, describe, expect, it } from 'vitest'

import { app } from '#app'
import { type ChangeEvent, subscribeToChangeEvents } from '#lib/change-events'
import { assertDefined, jsonBody, setupTestDb } from '#testing'

setupTestDb()

let stopWatchingChanges: (() => void) | undefined

afterEach(() => {
  stopWatchingChanges?.()
  stopWatchingChanges = undefined
})

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000'

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
  start: string
  end: string
  context: string
  color: string | null
  recurrence: ScheduleResponse['recurrence']
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
  const res = await app.request('/api/schedule/recurring', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { res, body: await jsonBody<ScheduleResponse>(res) }
}

async function putScheduleOverride(
  scheduleId: string,
  occurrenceDate: string,
  body: unknown,
) {
  return app.request(
    `/api/schedule/recurring/${scheduleId}/overrides/${occurrenceDate}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
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
  describe('POST /api/schedule/recurring', () => {
    it('creates a schedule without recurrence', async () => {
      const { res, body } = await createSchedule({
        title: 'Sleep',
        startTime: '23:00',
        endTime: '07:00',
      })

      expect(res.status).toBe(201)
      expect(body.title).toBe('Sleep')
      expect(body.startTime).toBe('23:00')
      expect(body.endTime).toBe('07:00')
      expect(body.recurrence).toBeNull()
      expect(body.context).toBe('personal')
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
      const res = await app.request('/api/schedule/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: '09:00',
          endTime: '10:00',
        }),
      })
      expect(res.status).toBe(400)
    })

    it('returns 400 for invalid time format', async () => {
      const res = await app.request('/api/schedule/recurring', {
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

  describe('GET /api/schedule/recurring', () => {
    it('returns expanded schedules for a date', async () => {
      await createSchedule({
        title: 'Morning Routine',
        startTime: '06:00',
        endTime: '07:00',
      })

      const res = await app.request(
        '/api/schedule/recurring?startDate=2026-03-22&endDate=2026-03-22',
      )
      expect(res.status).toBe(200)

      const blocks = await jsonBody<ExpandedBlock[]>(res)
      expect(blocks).toHaveLength(1)
      assertDefined(blocks[0])
      expect(blocks[0].title).toBe('Morning Routine')
      expect(blocks[0].start).toBe('2026-03-22T06:00:00')
      expect(blocks[0].end).toBe('2026-03-22T07:00:00')
    })

    it('returns cross-midnight blocks correctly', async () => {
      await createSchedule({
        title: 'Sleep',
        startTime: '23:00',
        endTime: '07:00',
      })

      const res = await app.request(
        '/api/schedule/recurring?startDate=2026-03-22&endDate=2026-03-22',
      )
      expect(res.status).toBe(200)

      const blocks = await jsonBody<ExpandedBlock[]>(res)
      expect(blocks).toHaveLength(2)

      const startBlock = blocks.find((b) => b.start.includes('T23:00'))
      assertDefined(startBlock)
      expect(startBlock.end).toBe('2026-03-23T00:00:00')

      const endBlock = blocks.find((b) => b.start.includes('T00:00'))
      assertDefined(endBlock)
      expect(endBlock.end).toBe('2026-03-22T07:00:00')
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
        '/api/schedule/recurring?startDate=2026-03-23&endDate=2026-03-23',
      )
      const mondayBlocks = await jsonBody<ExpandedBlock[]>(mondayRes)
      expect(mondayBlocks).toHaveLength(1)

      // 2026-03-24 is Tuesday
      const tuesdayRes = await app.request(
        '/api/schedule/recurring?startDate=2026-03-24&endDate=2026-03-24',
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
        '/api/schedule/recurring?startDate=2026-03-23&endDate=2026-03-25',
      )
      expect(res.status).toBe(200)

      const blocks = await jsonBody<ExpandedBlock[]>(res)
      expect(blocks.map((b) => b.start)).toEqual([
        '2026-03-23T18:00:00',
        '2026-03-25T18:00:00',
      ])
    })
  })

  describe('PATCH /api/schedule/recurring/:id', () => {
    it('updates schedule title', async () => {
      const { body: created } = await createSchedule({
        title: 'Sleep',
        startTime: '23:00',
        endTime: '07:00',
      })

      const res = await app.request(`/api/schedule/recurring/${created.id}`, {
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

      const res = await app.request(`/api/schedule/recurring/${created.id}`, {
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

      const res = await app.request(`/api/schedule/recurring/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recurrence: null }),
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<ScheduleResponse>(res)
      expect(body.recurrence).toBeNull()
    })

    it('returns 404 for non-existent schedule', async () => {
      const res = await app.request(`/api/schedule/recurring/${TEST_UUID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Nope' }),
      })
      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/schedule/recurring/:id', () => {
    it('deletes a schedule', async () => {
      const { body: created } = await createSchedule({
        title: 'To Delete',
        startTime: '09:00',
        endTime: '10:00',
      })

      const res = await app.request(`/api/schedule/recurring/${created.id}`, {
        method: 'DELETE',
      })
      expect(res.status).toBe(204)

      // Verify it's gone
      const getRes = await app.request(
        '/api/schedule/recurring?startDate=2026-03-22&endDate=2026-03-22',
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

      const res = await app.request(`/api/schedule/recurring/${created.id}`, {
        method: 'DELETE',
      })
      expect(res.status).toBe(204)
    })

    it('returns 404 for non-existent schedule', async () => {
      const res = await app.request(`/api/schedule/recurring/${TEST_UUID}`, {
        method: 'DELETE',
      })
      expect(res.status).toBe(404)
    })
  })
})

describe('schedule overrides API', () => {
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
      '/api/schedule/recurring?startDate=2026-03-22&endDate=2026-03-22',
    )
    expect(await jsonBody<ExpandedBlock[]>(response)).toEqual([
      {
        scheduleId: schedule.id,
        title: 'Routine',
        start: '2026-03-22T08:30:00',
        end: '2026-03-22T09:45:00',
        context: 'personal',
        color: null,
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
    const url = `/api/schedule/recurring/${schedule.id}/overrides/2026-03-22`
    await putScheduleOverride(schedule.id, '2026-03-22', {
      startTime: '08:30',
      endTime: '09:45',
    })
    await app.request(url, { method: 'DELETE' })

    const response = await app.request(
      '/api/schedule/recurring?startDate=2026-03-22&endDate=2026-03-22',
    )
    expect(await jsonBody<ExpandedBlock[]>(response)).toEqual([
      {
        scheduleId: schedule.id,
        title: 'Routine',
        start: '2026-03-22T09:00:00',
        end: '2026-03-22T10:00:00',
        context: 'personal',
        color: null,
        recurrence: null,
      },
    ])
  })

  it('skips an occurrence without changing other dates', async () => {
    const { body: schedule } = await createSchedule({
      title: 'Routine',
      startTime: '09:00',
      endTime: '10:00',
    })
    await putScheduleOverride(schedule.id, '2026-03-22', { skipped: true })
    const response = await app.request(
      '/api/schedule/recurring?startDate=2026-03-22&endDate=2026-03-23',
    )

    expect(await jsonBody<ExpandedBlock[]>(response)).toEqual([
      {
        scheduleId: schedule.id,
        title: 'Routine',
        start: '2026-03-23T09:00:00',
        end: '2026-03-23T10:00:00',
        context: 'personal',
        color: null,
        recurrence: null,
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
      '/api/schedule/recurring?startDate=2026-03-23&endDate=2026-03-23',
    )

    expect(await jsonBody<ExpandedBlock[]>(nextDateResponse)).toEqual([
      {
        scheduleId: schedule.id,
        title: 'Overnight Routine',
        start: '2026-03-23T23:00:00',
        end: '2026-03-24T00:00:00',
        context: 'personal',
        color: null,
        recurrence: null,
      },
      {
        scheduleId: schedule.id,
        title: 'Overnight Routine',
        start: '2026-03-23T00:00:00',
        end: '2026-03-23T08:00:00',
        context: 'personal',
        color: null,
        recurrence: null,
      },
    ])
  })

  it('rejects an incomplete time range', async () => {
    const { body: schedule } = await createSchedule({
      title: 'Routine',
      startTime: '09:00',
      endTime: '10:00',
    })
    const response = await putScheduleOverride(schedule.id, '2026-03-22', {
      startTime: '08:30',
    })

    expect(response.status).toBe(400)
  })

  it('rejects a time outside the 24-hour clock', async () => {
    const { body: schedule } = await createSchedule({
      title: 'Routine',
      startTime: '09:00',
      endTime: '10:00',
    })
    const response = await putScheduleOverride(schedule.id, '2026-03-22', {
      startTime: '24:00',
      endTime: '09:45',
    })

    expect(response.status).toBe(400)
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

  it('returns 404 for an unknown schedule', async () => {
    const response = await putScheduleOverride(TEST_UUID, '2026-03-22', {
      skipped: true,
    })

    expect(response.status).toBe(404)
  })
})
