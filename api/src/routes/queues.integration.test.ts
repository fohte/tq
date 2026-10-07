import { describe, expect, it } from 'vitest'

import { app } from '#app'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000'

interface QueueResponse {
  key: string
  name: string
  periodUnit: 'day' | 'week' | 'month' | null
  position: number
}

interface QueueItemResponse {
  id: string
  taskId: string
  periodStart: string | null
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
  return jsonBody<{ id: string; number: number }>(res)
}

async function putQueueItems(
  key: string,
  taskIds: (string | number)[],
  date: string,
) {
  const res = await app.request(`/api/queues/${key}/items`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskIds, date }),
  })
  return { res, body: await jsonBody<QueueItemResponse[]>(res) }
}

async function getQueueItems(key: string, date: string) {
  const res = await app.request(`/api/queues/${key}/items?date=${date}`)
  return { res, body: await jsonBody<QueueItemResponse[]>(res) }
}

async function carryOverQueueItems(date: string) {
  return app.request('/api/queues/carry-over', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date }),
  })
}

async function updateTaskStatus(taskId: string, status: string) {
  return app.request(`/api/tasks/${taskId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
}

function queueOrder(items: QueueItemResponse[]) {
  return items.map(({ id, taskId, periodStart, sortOrder }) => ({
    id,
    taskId,
    periodStart,
    sortOrder,
  }))
}

function normalizeQueueResponse(
  result: Awaited<ReturnType<typeof getQueueItems>>,
) {
  return {
    status: result.res.status,
    body: result.body.map(normalizeItem),
  }
}

async function updateTaskDueDate(taskId: string, dueDate: string | null) {
  return app.request(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dueDate }),
  })
}

function normalizeItem(item: QueueItemResponse) {
  return { ...item, id: 'ID', createdAt: 'TIMESTAMP', updatedAt: 'TIMESTAMP' }
}

function normalizeDueDateUpdate(
  before: Awaited<ReturnType<typeof getQueueItems>>,
  update: Awaited<ReturnType<typeof updateTaskDueDate>>,
  after: Awaited<ReturnType<typeof getQueueItems>>,
) {
  return {
    beforeStatus: before.res.status,
    updateStatus: update.status,
    afterStatus: after.res.status,
    beforeItems: before.body.map(normalizeItem),
    afterItems: after.body.map(normalizeItem),
  }
}

describe('GET /api/queues', () => {
  it('returns the seeded queues ordered by position', async () => {
    const res = await app.request('/api/queues')
    const body = await jsonBody<QueueResponse[]>(res)

    expect(res.status).toBe(200)
    expect(body).toEqual([
      { key: 'day', name: 'today', periodUnit: 'day', position: 0 },
      { key: 'week', name: 'this week', periodUnit: 'week', position: 1 },
    ])
  })
})

describe('PUT /api/queues/:key/items', () => {
  it('stores the selection for a day queue under the given date', async () => {
    const taskA = await createTask('Task A')
    const taskB = await createTask('Task B')

    const { res, body } = await putQueueItems(
      'day',
      [taskB.id, taskA.id],
      '2026-03-22',
    )

    expect(res.status).toBe(200)
    expect(body.map(normalizeItem)).toEqual([
      {
        id: 'ID',
        taskId: taskB.id,
        periodStart: '2026-03-22',
        sortOrder: 0,
        createdAt: 'TIMESTAMP',
        updatedAt: 'TIMESTAMP',
      },
      {
        id: 'ID',
        taskId: taskA.id,
        periodStart: '2026-03-22',
        sortOrder: 1,
        createdAt: 'TIMESTAMP',
        updatedAt: 'TIMESTAMP',
      },
    ])
  })

  it('resolves task numbers and deduplicates UUID aliases in input order', async () => {
    const taskA = await createTask('First numbered task')
    const taskB = await createTask('Second numbered task')

    const { res, body } = await putQueueItems(
      'day',
      [String(taskB.number), taskA.number, taskB.id],
      '2026-03-22',
    )

    const getActual = () => ({
      status: res.status,
      body: body.map(normalizeItem),
    })

    expect(getActual()).toEqual({
      status: 200,
      body: [
        {
          id: 'ID',
          taskId: taskB.id,
          periodStart: '2026-03-22',
          sortOrder: 0,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
        {
          id: 'ID',
          taskId: taskA.id,
          periodStart: '2026-03-22',
          sortOrder: 1,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
      ],
    })
  })

  it('rounds the date down to the Monday of its week for a week queue', async () => {
    const task = await createTask('Task A')

    // 2026-03-22 is a Sunday; the Monday of that week is 2026-03-16.
    const { res, body } = await putQueueItems('week', [task.id], '2026-03-22')

    expect(res.status).toBe(200)
    expect(body.map(normalizeItem)).toEqual([
      {
        id: 'ID',
        taskId: task.id,
        periodStart: '2026-03-16',
        sortOrder: 0,
        createdAt: 'TIMESTAMP',
        updatedAt: 'TIMESTAMP',
      },
    ])
  })

  it('fully replaces the selection while preserving existing sort order', async () => {
    const taskA = await createTask('Task A')
    const taskB = await createTask('Task B')
    const taskC = await createTask('Task C')

    await putQueueItems('day', [taskA.id, taskB.id], '2026-03-22')
    const response = await putQueueItems(
      'day',
      [taskC.id, taskA.id],
      '2026-03-22',
    )

    expect(normalizeQueueResponse(response)).toEqual({
      status: 200,
      body: [
        {
          id: 'ID',
          taskId: taskC.id,
          periodStart: '2026-03-22',
          sortOrder: 1,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
        {
          id: 'ID',
          taskId: taskA.id,
          periodStart: '2026-03-22',
          sortOrder: 0,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
      ],
    })
  })

  it('preserves retained sort order and appends new tasks after removal', async () => {
    const taskA = await createTask('Task A', { dueDate: '2026-03-22' })
    const taskB = await createTask('Task B', { dueDate: '2026-03-22' })
    const taskC = await createTask('Task C', { dueDate: '2026-03-22' })
    const taskD = await createTask('Task D', { dueDate: '2026-03-22' })

    await putQueueItems('day', [taskA.id, taskB.id, taskC.id], '2026-03-22')
    await putQueueItems('day', [taskB.id, taskA.id, taskD.id], '2026-03-22')

    const response = await getQueueItems('day', '2026-03-22')

    expect(normalizeQueueResponse(response)).toEqual({
      status: 200,
      body: [
        {
          id: 'ID',
          taskId: taskA.id,
          periodStart: '2026-03-22',
          sortOrder: 0,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
        {
          id: 'ID',
          taskId: taskB.id,
          periodStart: '2026-03-22',
          sortOrder: 1,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
        {
          id: 'ID',
          taskId: taskD.id,
          periodStart: '2026-03-22',
          sortOrder: 2,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
      ],
    })
  })

  it('clears the queue when given an empty list', async () => {
    const taskA = await createTask('Task A')
    await putQueueItems('day', [taskA.id], '2026-03-22')

    const { res, body } = await putQueueItems('day', [], '2026-03-22')

    expect(res.status).toBe(200)
    expect(body).toEqual([])
  })

  it('deduplicates repeated task ids in the selection', async () => {
    const taskA = await createTask('Task A')

    const { res, body } = await putQueueItems(
      'day',
      [taskA.id, taskA.id],
      '2026-03-22',
    )

    expect(res.status).toBe(200)
    expect(body.map((item) => item.taskId)).toEqual([taskA.id])
  })

  it('returns the same not-found response for a missing UUID or task number', async () => {
    const results = await Promise.all(
      [TEST_UUID, '2147483647'].map(async (taskId) => {
        const res = await app.request('/api/queues/day/items', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskIds: [taskId], date: '2026-03-22' }),
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

  it('returns 404 for a non-existent queue key', async () => {
    const task = await createTask('Task A')
    const { res } = await putQueueItems('nope', [task.id], '2026-03-22')
    expect(res.status).toBe(404)
  })

  it('returns 400 for a malformed date', async () => {
    const taskA = await createTask('Task A')
    const { res } = await putQueueItems('day', [taskA.id], '2026/03/22')
    expect(res.status).toBe(400)
  })

  it('moving a task into the week queue removes it from the day queue for an overlapping date', async () => {
    const task = await createTask('Task A')
    // 2026-03-18 (Wed) falls in the week starting 2026-03-16 (Mon).
    await putQueueItems('day', [task.id], '2026-03-18')

    await putQueueItems('week', [task.id], '2026-03-18')

    const { body: dayItems } = await getQueueItems('day', '2026-03-18')
    expect(dayItems).toEqual([])
  })

  it('moving a task into the day queue removes it from the week queue for an overlapping date', async () => {
    const task = await createTask('Task A')
    await putQueueItems('week', [task.id], '2026-03-18')

    await putQueueItems('day', [task.id], '2026-03-18')

    const { body: weekItems } = await getQueueItems('week', '2026-03-18')
    expect(weekItems).toEqual([])
  })

  it('does not touch a day-queue row for a different date when adding to the week queue', async () => {
    const task = await createTask('Task A')
    await putQueueItems('day', [task.id], '2026-01-05')

    await putQueueItems('week', [task.id], '2026-03-18')

    const { body: dayItems } = await getQueueItems('day', '2026-01-05')
    expect(dayItems.map((item) => item.taskId)).toEqual([task.id])
  })
})

describe('POST /api/queues/carry-over', () => {
  it('moves unfinished day items to today, deduplicates them, and appends after existing items', async () => {
    const existingTask = await createTask('Existing task')
    const carriedTask = await createTask('Carried task')
    const secondCarriedTask = await createTask('Second carried task')
    const todayRow = await putQueueItems('day', [existingTask.id], '2026-03-20')
    const earliestCarriedRow = await putQueueItems(
      'day',
      [carriedTask.id],
      '2026-03-17',
    )
    await putQueueItems('day', [carriedTask.id], '2026-03-18')
    const secondCarriedRow = await putQueueItems(
      'day',
      [secondCarriedTask.id],
      '2026-03-19',
    )

    const firstRun = await carryOverQueueItems('2026-03-20')
    const secondRun = await carryOverQueueItems('2026-03-20')
    const today = await getQueueItems('day', '2026-03-20')
    const yesterday = await getQueueItems('day', '2026-03-19')
    const earlierDay = await getQueueItems('day', '2026-03-18')
    const earliestDay = await getQueueItems('day', '2026-03-17')

    const getOutput = () => [
      [firstRun.status, secondRun.status],
      queueOrder(today.body),
      [
        yesterday.body.map((item) => item.taskId),
        earlierDay.body.map((item) => item.taskId),
        earliestDay.body.map((item) => item.taskId),
      ],
    ]
    expect(getOutput()).toEqual([
      [204, 204],
      [
        {
          id: todayRow.body[0]?.id,
          taskId: existingTask.id,
          periodStart: '2026-03-20',
          sortOrder: 0,
        },
        {
          id: earliestCarriedRow.body[0]?.id,
          taskId: carriedTask.id,
          periodStart: '2026-03-20',
          sortOrder: 1,
        },
        {
          id: secondCarriedRow.body[0]?.id,
          taskId: secondCarriedTask.id,
          periodStart: '2026-03-20',
          sortOrder: 2,
        },
      ],
      [[], [], []],
    ])
  })

  it('leaves completed items and items with a today-or-later queue entry in their original periods', async () => {
    const completedTask = await createTask('Completed task')
    const todayTask = await createTask('Today task')
    const futureDayTask = await createTask('Future day task')
    const currentWeekTask = await createTask('Current week task')
    const futureWeekTask = await createTask('Future week task')
    await putQueueItems(
      'day',
      [
        completedTask.id,
        todayTask.id,
        futureDayTask.id,
        currentWeekTask.id,
        futureWeekTask.id,
      ],
      '2026-03-19',
    )
    const completeResponse = await updateTaskStatus(
      completedTask.id,
      'completed',
    )
    await putQueueItems('day', [todayTask.id], '2026-03-20')
    await putQueueItems('day', [futureDayTask.id], '2026-03-23')
    await putQueueItems('week', [currentWeekTask.id], '2026-03-18')
    await putQueueItems('week', [futureWeekTask.id], '2026-03-23')

    const carryResponse = await carryOverQueueItems('2026-03-20')
    const oldDay = await getQueueItems('day', '2026-03-19')
    const today = await getQueueItems('day', '2026-03-20')
    const futureDay = await getQueueItems('day', '2026-03-23')
    const currentWeek = await getQueueItems('week', '2026-03-20')
    const futureWeek = await getQueueItems('week', '2026-03-23')

    const getOutput = () => [
      [completeResponse.status, carryResponse.status],
      oldDay.body.map((item) => item.taskId),
      today.body.map((item) => item.taskId),
      futureDay.body.map((item) => item.taskId),
      currentWeek.body.map((item) => item.taskId),
      futureWeek.body.map((item) => item.taskId),
    ]
    expect(getOutput()).toEqual([
      [200, 204],
      [
        completedTask.id,
        todayTask.id,
        futureDayTask.id,
        currentWeekTask.id,
        futureWeekTask.id,
      ],
      [todayTask.id],
      [futureDayTask.id],
      [currentWeekTask.id],
      [futureWeekTask.id],
    ])
  })

  it('moves unfinished prior-week items to this week once, deduplicates them, and appends after existing items', async () => {
    const existingTask = await createTask('Existing task')
    const carriedTask = await createTask('Carried task')
    const secondCarriedTask = await createTask('Second carried task')
    const completedTask = await createTask('Completed prior-week task')
    const currentWeekRow = await putQueueItems(
      'week',
      [existingTask.id],
      '2026-03-18',
    )
    const earliestCarriedRow = await putQueueItems(
      'week',
      [carriedTask.id],
      '2026-03-02',
    )
    await putQueueItems('week', [carriedTask.id], '2026-03-09')
    const priorWeekRows = await putQueueItems(
      'week',
      [secondCarriedTask.id, completedTask.id],
      '2026-03-09',
    )
    const secondCarriedRow = priorWeekRows.body[0]
    await updateTaskStatus(completedTask.id, 'completed')

    const firstRun = await carryOverQueueItems('2026-03-20')
    const secondRun = await carryOverQueueItems('2026-03-20')
    const currentWeek = await getQueueItems('week', '2026-03-20')
    const priorWeek = await getQueueItems('week', '2026-03-09')
    const earlierWeek = await getQueueItems('week', '2026-03-02')

    const getOutput = () => [
      [firstRun.status, secondRun.status],
      queueOrder(currentWeek.body),
      [
        priorWeek.body.map((item) => item.taskId),
        earlierWeek.body.map((item) => item.taskId),
      ],
    ]
    expect(getOutput()).toEqual([
      [204, 204],
      [
        {
          id: currentWeekRow.body[0]?.id,
          taskId: existingTask.id,
          periodStart: '2026-03-16',
          sortOrder: 0,
        },
        {
          id: earliestCarriedRow.body[0]?.id,
          taskId: carriedTask.id,
          periodStart: '2026-03-16',
          sortOrder: 1,
        },
        {
          id: secondCarriedRow?.id,
          taskId: secondCarriedTask.id,
          periodStart: '2026-03-16',
          sortOrder: 2,
        },
      ],
      [[completedTask.id], []],
    ])
  })

  it('keeps prior-week items when they are planned in a current or future week or day, or carried into today', async () => {
    const todayTask = await createTask('Today task')
    const futureDayTask = await createTask('Future day task')
    const currentWeekTask = await createTask('Current week task')
    const futureWeekTask = await createTask('Future week task')
    const dayCarriedTask = await createTask('Day carried task')
    await putQueueItems(
      'week',
      [
        todayTask.id,
        futureDayTask.id,
        currentWeekTask.id,
        futureWeekTask.id,
        dayCarriedTask.id,
      ],
      '2026-03-09',
    )
    await putQueueItems('day', [todayTask.id], '2026-03-20')
    await putQueueItems('day', [futureDayTask.id], '2026-03-23')
    await putQueueItems('week', [currentWeekTask.id], '2026-03-18')
    await putQueueItems('week', [futureWeekTask.id], '2026-03-23')
    await putQueueItems('day', [dayCarriedTask.id], '2026-03-19')

    const carryResponse = await carryOverQueueItems('2026-03-20')
    const priorWeek = await getQueueItems('week', '2026-03-09')
    const currentWeek = await getQueueItems('week', '2026-03-20')
    const today = await getQueueItems('day', '2026-03-20')
    const futureDay = await getQueueItems('day', '2026-03-23')
    const futureWeek = await getQueueItems('week', '2026-03-23')

    const getOutput = () => [
      carryResponse.status,
      priorWeek.body.map((item) => item.taskId),
      currentWeek.body.map((item) => item.taskId),
      today.body.map((item) => item.taskId),
      futureDay.body.map((item) => item.taskId),
      futureWeek.body.map((item) => item.taskId),
    ]
    expect(getOutput()).toEqual([
      204,
      [
        todayTask.id,
        futureDayTask.id,
        currentWeekTask.id,
        futureWeekTask.id,
        dayCarriedTask.id,
      ],
      [currentWeekTask.id],
      [todayTask.id, dayCarriedTask.id],
      [futureDayTask.id],
      [futureWeekTask.id],
    ])
  })

  it('returns 400 for a malformed date', async () => {
    const response = await carryOverQueueItems('2026/03/20')

    expect(response.status).toBe(400)
  })
})

describe('GET /api/queues/:key/items', () => {
  it('returns the selection persisted by a previous PUT', async () => {
    const taskA = await createTask('Task A')
    const taskB = await createTask('Task B')
    await putQueueItems('day', [taskB.id, taskA.id], '2026-03-22')

    const { res, body } = await getQueueItems('day', '2026-03-22')

    expect(res.status).toBe(200)
    expect(body.map((item) => item.taskId)).toEqual([taskB.id, taskA.id])
  })

  it.each([
    ['day', '2026-03-22', '2026-03-22'],
    ['week', '2026-03-22', '2026-03-16'],
  ] as const)(
    'orders the %s queue by due date and keeps insertion order for ties and missing dates',
    async (key, date, periodStart) => {
      const noDueFirst = await createTask('No due first')
      const laterDue = await createTask('Later due', {
        dueDate: '2026-03-29',
      })
      const sameDueFirst = await createTask('Same due first', {
        dueDate: '2026-03-22',
      })
      const earliestDue = await createTask('Earliest due', {
        dueDate: '2026-03-20',
      })
      const sameDueSecond = await createTask('Same due second', {
        dueDate: '2026-03-22',
      })
      const noDueSecond = await createTask('No due second')
      const taskIds = [
        noDueFirst.id,
        laterDue.id,
        sameDueFirst.id,
        earliestDue.id,
        sameDueSecond.id,
        noDueSecond.id,
      ]
      await putQueueItems(key, taskIds, date)

      const response = await getQueueItems(key, date)

      expect(normalizeQueueResponse(response)).toEqual({
        status: 200,
        body: [
          {
            id: 'ID',
            taskId: earliestDue.id,
            periodStart,
            sortOrder: 3,
            createdAt: 'TIMESTAMP',
            updatedAt: 'TIMESTAMP',
          },
          {
            id: 'ID',
            taskId: sameDueFirst.id,
            periodStart,
            sortOrder: 2,
            createdAt: 'TIMESTAMP',
            updatedAt: 'TIMESTAMP',
          },
          {
            id: 'ID',
            taskId: sameDueSecond.id,
            periodStart,
            sortOrder: 4,
            createdAt: 'TIMESTAMP',
            updatedAt: 'TIMESTAMP',
          },
          {
            id: 'ID',
            taskId: laterDue.id,
            periodStart,
            sortOrder: 1,
            createdAt: 'TIMESTAMP',
            updatedAt: 'TIMESTAMP',
          },
          {
            id: 'ID',
            taskId: noDueFirst.id,
            periodStart,
            sortOrder: 0,
            createdAt: 'TIMESTAMP',
            updatedAt: 'TIMESTAMP',
          },
          {
            id: 'ID',
            taskId: noDueSecond.id,
            periodStart,
            sortOrder: 5,
            createdAt: 'TIMESTAMP',
            updatedAt: 'TIMESTAMP',
          },
        ],
      })
    },
  )

  it('reflects a task due date update in the next queue read', async () => {
    const taskA = await createTask('Task A', { dueDate: '2026-03-20' })
    const taskB = await createTask('Task B', { dueDate: '2026-03-22' })
    await putQueueItems('day', [taskA.id, taskB.id], '2026-03-22')

    const before = await getQueueItems('day', '2026-03-22')
    const update = await updateTaskDueDate(taskA.id, '2026-03-29')
    const after = await getQueueItems('day', '2026-03-22')

    expect(normalizeDueDateUpdate(before, update, after)).toEqual({
      beforeStatus: 200,
      updateStatus: 200,
      afterStatus: 200,
      beforeItems: [
        {
          id: 'ID',
          taskId: taskA.id,
          periodStart: '2026-03-22',
          sortOrder: 0,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
        {
          id: 'ID',
          taskId: taskB.id,
          periodStart: '2026-03-22',
          sortOrder: 1,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
      ],
      afterItems: [
        {
          id: 'ID',
          taskId: taskB.id,
          periodStart: '2026-03-22',
          sortOrder: 1,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
        {
          id: 'ID',
          taskId: taskA.id,
          periodStart: '2026-03-22',
          sortOrder: 0,
          createdAt: 'TIMESTAMP',
          updatedAt: 'TIMESTAMP',
        },
      ],
    })
  })

  it('returns an empty array when nothing is persisted for the period', async () => {
    const { res, body } = await getQueueItems('day', '2026-03-22')

    expect(res.status).toBe(200)
    expect(body).toEqual([])
  })

  it('returns items for the whole week regardless of which day in it is requested', async () => {
    const task = await createTask('Task A')
    await putQueueItems('week', [task.id], '2026-03-16')

    const { res, body } = await getQueueItems('week', '2026-03-20')

    expect(res.status).toBe(200)
    expect(body.map((item) => item.taskId)).toEqual([task.id])
  })

  it('returns 404 for a non-existent queue key', async () => {
    const res = await app.request('/api/queues/nope/items?date=2026-03-22')
    expect(res.status).toBe(404)
  })

  it('returns 400 for a malformed date', async () => {
    const res = await app.request('/api/queues/day/items?date=2026/03/22')
    expect(res.status).toBe(400)
  })
})
