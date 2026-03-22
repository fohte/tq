import { app } from '@api/app'
import { setupTestDb } from '@api/testing'
import { describe, expect, it } from 'vitest'

setupTestDb()

interface TimeBlockResponse {
  id: string
  taskId: string
  startTime: string
  endTime: string | null
  isAutoScheduled: boolean
  createdAt: string
  updatedAt: string
}

async function createTask(title: string) {
  const res = await app.request('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  return (await res.json()) as { id: string }
}

async function createTimeBlock(
  taskId: string,
  startTime: string,
  endTime: string | null,
) {
  const res = await app.request('/api/schedule/time-blocks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId, startTime, endTime }),
  })
  return { res, body: (await res.json()) as TimeBlockResponse }
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
          taskId: '550e8400-e29b-41d4-a716-446655440000',
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

      const blocks = (await res.json()) as TimeBlockResponse[]
      expect(blocks.length).toBe(2)
      expect(blocks[0]!.startTime).toBe('2026-03-22T09:00:00.000Z')
    })

    it('returns empty array when no blocks exist', async () => {
      const res = await app.request('/api/schedule/time-blocks?date=2026-03-22')
      expect(res.status).toBe(200)

      const blocks = (await res.json()) as TimeBlockResponse[]
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
      const body = (await res.json()) as TimeBlockResponse
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
      const body = (await res.json()) as TimeBlockResponse
      expect(body.startTime).toBe('2026-03-22T09:00:00.000Z')
      expect(body.endTime).toBe('2026-03-22T11:30:00.000Z')
    })

    it('returns 404 for non-existent time block', async () => {
      const res = await app.request(
        '/api/schedule/time-blocks/550e8400-e29b-41d4-a716-446655440000',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startTime: '2026-03-22T11:00:00.000Z',
          }),
        },
      )

      expect(res.status).toBe(404)
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
      const blocks = (await listRes.json()) as TimeBlockResponse[]
      expect(blocks.length).toBe(0)
    })

    it('returns 404 for non-existent time block', async () => {
      const res = await app.request(
        '/api/schedule/time-blocks/550e8400-e29b-41d4-a716-446655440000',
        { method: 'DELETE' },
      )

      expect(res.status).toBe(404)
    })
  })
})
