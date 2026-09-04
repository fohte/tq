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
  return jsonBody<{ id: string }>(res)
}

async function putQueueItems(key: string, taskIds: string[], date: string) {
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

function normalizeItem(item: QueueItemResponse) {
  return { ...item, id: 'ID', createdAt: 'TIMESTAMP', updatedAt: 'TIMESTAMP' }
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

  it('fully replaces the previous selection (reorder, add, remove)', async () => {
    const taskA = await createTask('Task A')
    const taskB = await createTask('Task B')
    const taskC = await createTask('Task C')

    await putQueueItems('day', [taskA.id, taskB.id], '2026-03-22')
    const { res, body } = await putQueueItems(
      'day',
      [taskC.id, taskA.id],
      '2026-03-22',
    )

    expect(res.status).toBe(200)
    expect(body.map((item) => item.taskId)).toEqual([taskC.id, taskA.id])
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

  it('returns 404 for a non-existent task id', async () => {
    const { res } = await putQueueItems('day', [TEST_UUID], '2026-03-22')
    expect(res.status).toBe(404)
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

describe('GET /api/queues/:key/items', () => {
  it('returns the selection persisted by a previous PUT', async () => {
    const taskA = await createTask('Task A')
    const taskB = await createTask('Task B')
    await putQueueItems('day', [taskB.id, taskA.id], '2026-03-22')

    const { res, body } = await getQueueItems('day', '2026-03-22')

    expect(res.status).toBe(200)
    expect(body.map((item) => item.taskId)).toEqual([taskB.id, taskA.id])
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
