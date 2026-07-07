import { app } from '@api/app'
import { assertDefined, jsonBody, setupTestDb } from '@api/testing'
import { describe, expect, it } from 'vitest'

setupTestDb()

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000'

interface TimeBlockResponse {
  id: string
  taskId: string
  startTime: string
  endTime: string | null
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

interface TodayTaskResponse {
  id: string
  taskId: string
  date: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

async function createTask(title: string, extra: Record<string, unknown> = {}) {
  const res = await app.request('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, ...extra }),
  })
  return jsonBody<{ id: string }>(res)
}

async function completeTask(taskId: string) {
  await app.request(`/api/tasks/${taskId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'completed' }),
  })
}

async function putTodayTasks(taskIds: string[], date: string) {
  const res = await app.request('/api/schedule/today-tasks', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskIds, date }),
  })
  return { res, body: await jsonBody<TodayTaskResponse[]>(res) }
}

async function requestAutoAssign(date: string, tzOffset = 0) {
  const res = await app.request('/api/schedule/auto-assign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, tzOffset }),
  })
  return { res, body: await jsonBody<TimeBlockResponse[]>(res) }
}

function normalizeTodayTask(task: TodayTaskResponse) {
  return { ...task, id: 'ID', createdAt: 'TIMESTAMP', updatedAt: 'TIMESTAMP' }
}

function normalizeTimeBlock(block: TimeBlockResponse) {
  return { ...block, id: 'ID', createdAt: 'TIMESTAMP', updatedAt: 'TIMESTAMP' }
}

async function createTimeBlock(
  taskId: string,
  startTime: string,
  endTime: string | null,
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

describe('schedule/time-blocks API', () => {
  describe('POST /api/schedule/time-blocks', () => {
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

    it('creates a time block with null endTime', async () => {
      const task = await createTask('In-progress task')
      const { res, body } = await createTimeBlock(
        task.id,
        '2026-03-22T09:00:00.000Z',
        null,
      )

      expect(res.status).toBe(201)
      expect(body.endTime).toBeNull()
    })

    it('returns 404 for non-existent task', async () => {
      const res = await app.request('/api/schedule/time-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: TEST_UUID,
          startTime: '2026-03-22T09:00:00.000Z',
          endTime: '2026-03-22T10:00:00.000Z',
        }),
      })

      expect(res.status).toBe(404)
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

      const res = await app.request('/api/schedule/time-blocks?date=2026-03-22')
      expect(res.status).toBe(200)

      const blocks = await jsonBody<TimeBlockResponse[]>(res)
      expect(blocks.length).toBe(2)
      assertDefined(blocks[0])
      expect(blocks[0].startTime).toBe('2026-03-22T09:00:00.000Z')
    })

    it('returns empty array when no blocks exist', async () => {
      const res = await app.request('/api/schedule/time-blocks?date=2026-03-22')
      expect(res.status).toBe(200)

      const blocks = await jsonBody<TimeBlockResponse[]>(res)
      expect(blocks.length).toBe(0)
    })
  })

  describe('PATCH /api/schedule/time-blocks/:id', () => {
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
        '/api/schedule/time-blocks?date=2026-03-22',
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

      const res = await app.request('/api/schedule/recurring?date=2026-03-22')
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

      const res = await app.request('/api/schedule/recurring?date=2026-03-22')
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
        '/api/schedule/recurring?date=2026-03-23',
      )
      const mondayBlocks = await jsonBody<ExpandedBlock[]>(mondayRes)
      expect(mondayBlocks).toHaveLength(1)

      // 2026-03-24 is Tuesday
      const tuesdayRes = await app.request(
        '/api/schedule/recurring?date=2026-03-24',
      )
      const tuesdayBlocks = await jsonBody<ExpandedBlock[]>(tuesdayRes)
      expect(tuesdayBlocks).toHaveLength(0)
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
        '/api/schedule/recurring?date=2026-03-22',
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

describe('schedule/today-tasks API', () => {
  describe('PUT /api/schedule/today-tasks', () => {
    it('returns the persisted selection in the given order', async () => {
      const taskA = await createTask('Task A')
      const taskB = await createTask('Task B')

      const { res, body } = await putTodayTasks(
        [taskB.id, taskA.id],
        '2026-03-22',
      )

      expect(res.status).toBe(200)
      expect(body.map(normalizeTodayTask)).toEqual([
        {
          id: 'ID',
          taskId: taskB.id,
          date: '2026-03-22',
          sortOrder: 0,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
        {
          id: 'ID',
          taskId: taskA.id,
          date: '2026-03-22',
          sortOrder: 1,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
      ])
    })

    it('fully replaces the previous selection (reorder, add, remove)', async () => {
      const taskA = await createTask('Task A')
      const taskB = await createTask('Task B')
      const taskC = await createTask('Task C')

      await putTodayTasks([taskA.id, taskB.id], '2026-03-22')
      const { res, body } = await putTodayTasks(
        [taskC.id, taskA.id],
        '2026-03-22',
      )

      expect(res.status).toBe(200)
      expect(body.map(normalizeTodayTask)).toEqual([
        {
          id: 'ID',
          taskId: taskC.id,
          date: '2026-03-22',
          sortOrder: 0,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
        {
          id: 'ID',
          taskId: taskA.id,
          date: '2026-03-22',
          sortOrder: 1,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
      ])
    })

    it('clears the queue when given an empty list', async () => {
      const taskA = await createTask('Task A')
      await putTodayTasks([taskA.id], '2026-03-22')

      const { res, body } = await putTodayTasks([], '2026-03-22')

      expect(res.status).toBe(200)
      expect(body).toEqual([])
    })

    it('returns 404 for a non-existent task id', async () => {
      const { res } = await putTodayTasks([TEST_UUID], '2026-03-22')
      expect(res.status).toBe(404)
    })

    it('returns 400 for a malformed date', async () => {
      const taskA = await createTask('Task A')
      const { res } = await putTodayTasks([taskA.id], '2026/03/22')
      expect(res.status).toBe(400)
    })

    it('deduplicates repeated task ids in the selection', async () => {
      const taskA = await createTask('Task A')

      const { res, body } = await putTodayTasks(
        [taskA.id, taskA.id],
        '2026-03-22',
      )

      expect(res.status).toBe(200)
      expect(body.map(normalizeTodayTask)).toEqual([
        {
          id: 'ID',
          taskId: taskA.id,
          date: '2026-03-22',
          sortOrder: 0,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
      ])
    })
  })

  describe('GET /api/schedule/today-tasks', () => {
    it('returns the selection persisted by a previous PUT', async () => {
      const taskA = await createTask('Task A')
      const taskB = await createTask('Task B')
      await putTodayTasks([taskB.id, taskA.id], '2026-03-22')

      const res = await app.request('/api/schedule/today-tasks?date=2026-03-22')

      expect(res.status).toBe(200)
      const body = await jsonBody<TodayTaskResponse[]>(res)
      expect(body.map(normalizeTodayTask)).toEqual([
        {
          id: 'ID',
          taskId: taskB.id,
          date: '2026-03-22',
          sortOrder: 0,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
        {
          id: 'ID',
          taskId: taskA.id,
          date: '2026-03-22',
          sortOrder: 1,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
      ])
    })

    it('returns an empty array when nothing is persisted for the date', async () => {
      const res = await app.request('/api/schedule/today-tasks?date=2026-03-22')

      expect(res.status).toBe(200)
      const body = await jsonBody<TodayTaskResponse[]>(res)
      expect(body).toEqual([])
    })
  })
})

// These tests rely on no oauth_tokens row existing in the test DB, so
// getEvents() always throws OAuthTokenMissingError and auto-assign proceeds
// as if no Google Calendar events exist.
describe('schedule/auto-assign API', () => {
  describe('POST /api/schedule/auto-assign', () => {
    it('assigns queued tasks back-to-back starting at the day boundary', async () => {
      const taskA = await createTask('Task A', { estimatedMinutes: 30 })
      const taskB = await createTask('Task B', { estimatedMinutes: 60 })
      await putTodayTasks([taskA.id, taskB.id], '2026-03-22')

      const { res, body } = await requestAutoAssign('2026-03-22')

      expect(res.status).toBe(200)
      expect(body.map(normalizeTimeBlock)).toEqual([
        {
          id: 'ID',
          taskId: taskA.id,
          startTime: '2026-03-22T00:00:00.000Z',
          endTime: '2026-03-22T00:30:00.000Z',
          isAutoScheduled: true,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
        {
          id: 'ID',
          taskId: taskB.id,
          startTime: '2026-03-22T00:30:00.000Z',
          endTime: '2026-03-22T01:30:00.000Z',
          isAutoScheduled: true,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
      ])
    })

    it('schedules around an existing manual time block', async () => {
      const busyTask = await createTask('Busy task')
      await createTimeBlock(
        busyTask.id,
        '2026-03-22T00:00:00.000Z',
        '2026-03-22T01:00:00.000Z',
      )

      const queuedTask = await createTask('Queued task', {
        estimatedMinutes: 30,
      })
      await putTodayTasks([queuedTask.id], '2026-03-22')

      const { res, body } = await requestAutoAssign('2026-03-22')

      expect(res.status).toBe(200)
      expect(body.map(normalizeTimeBlock)).toEqual([
        {
          id: 'ID',
          taskId: queuedTask.id,
          startTime: '2026-03-22T01:00:00.000Z',
          endTime: '2026-03-22T01:30:00.000Z',
          isAutoScheduled: true,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
      ])
    })

    it('excludes tasks without an estimate', async () => {
      const noEstimateTask = await createTask('No estimate')
      const withEstimateTask = await createTask('With estimate', {
        estimatedMinutes: 30,
      })
      await putTodayTasks(
        [noEstimateTask.id, withEstimateTask.id],
        '2026-03-22',
      )

      const { res, body } = await requestAutoAssign('2026-03-22')

      expect(res.status).toBe(200)
      expect(body.map(normalizeTimeBlock)).toEqual([
        {
          id: 'ID',
          taskId: withEstimateTask.id,
          startTime: '2026-03-22T00:00:00.000Z',
          endTime: '2026-03-22T00:30:00.000Z',
          isAutoScheduled: true,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
      ])
    })

    it('excludes completed tasks', async () => {
      const completedTask = await createTask('Completed', {
        estimatedMinutes: 30,
      })
      await completeTask(completedTask.id)
      const pendingTask = await createTask('Pending', { estimatedMinutes: 30 })
      await putTodayTasks([completedTask.id, pendingTask.id], '2026-03-22')

      const { res, body } = await requestAutoAssign('2026-03-22')

      expect(res.status).toBe(200)
      expect(body.map(normalizeTimeBlock)).toEqual([
        {
          id: 'ID',
          taskId: pendingTask.id,
          startTime: '2026-03-22T00:00:00.000Z',
          endTime: '2026-03-22T00:30:00.000Z',
          isAutoScheduled: true,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
      ])
    })

    it('replaces the previous auto-assigned blocks on re-run (idempotent)', async () => {
      const taskA = await createTask('Task A', { estimatedMinutes: 30 })
      await putTodayTasks([taskA.id], '2026-03-22')
      await requestAutoAssign('2026-03-22')

      const taskB = await createTask('Task B', { estimatedMinutes: 30 })
      await putTodayTasks([taskB.id, taskA.id], '2026-03-22')
      await requestAutoAssign('2026-03-22')

      const listRes = await app.request(
        '/api/schedule/time-blocks?date=2026-03-22',
      )

      expect(listRes.status).toBe(200)
      const blocks = await jsonBody<TimeBlockResponse[]>(listRes)
      expect(blocks.map(normalizeTimeBlock)).toEqual([
        {
          id: 'ID',
          taskId: taskB.id,
          startTime: '2026-03-22T00:00:00.000Z',
          endTime: '2026-03-22T00:30:00.000Z',
          isAutoScheduled: true,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
        {
          id: 'ID',
          taskId: taskA.id,
          startTime: '2026-03-22T00:30:00.000Z',
          endTime: '2026-03-22T01:00:00.000Z',
          isAutoScheduled: true,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
      ])
    })

    it('does not schedule anything when the queue is empty', async () => {
      const { res, body } = await requestAutoAssign('2026-03-22')

      expect(res.status).toBe(200)
      expect(body).toEqual([])
    })

    it('keeps a block promoted to manual instead of overwriting it on re-run', async () => {
      const taskA = await createTask('Task A', { estimatedMinutes: 30 })
      await putTodayTasks([taskA.id], '2026-03-22')
      const { body: firstRun } = await requestAutoAssign('2026-03-22')
      const dragged = firstRun[0]
      assertDefined(dragged)

      // Simulate the user dragging the auto-placed block to a new time,
      // which promotes it to manual.
      await app.request(`/api/schedule/time-blocks/${dragged.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: '2026-03-22T02:00:00.000Z',
          endTime: '2026-03-22T02:30:00.000Z',
          isAutoScheduled: false,
        }),
      })

      const taskB = await createTask('Task B', { estimatedMinutes: 30 })
      await putTodayTasks([taskB.id], '2026-03-22')
      await requestAutoAssign('2026-03-22')

      const listRes = await app.request(
        '/api/schedule/time-blocks?date=2026-03-22',
      )
      const blocks = await jsonBody<TimeBlockResponse[]>(listRes)
      expect(blocks.map(normalizeTimeBlock)).toEqual([
        {
          id: 'ID',
          taskId: taskB.id,
          startTime: '2026-03-22T00:00:00.000Z',
          endTime: '2026-03-22T00:30:00.000Z',
          isAutoScheduled: true,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
        {
          id: 'ID',
          taskId: taskA.id,
          startTime: '2026-03-22T02:00:00.000Z',
          endTime: '2026-03-22T02:30:00.000Z',
          isAutoScheduled: false,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
      ])
    })

    it('returns 400 for a malformed date', async () => {
      const { res } = await requestAutoAssign('2026/03/22')
      expect(res.status).toBe(400)
    })
  })
})
