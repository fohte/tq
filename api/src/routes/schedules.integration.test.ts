import { app } from '@api/app'
import { setupTestDb } from '@api/testing'
import { describe, expect, it } from 'vitest'

setupTestDb()

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000'

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

async function createSchedule(body: Record<string, unknown>) {
  const res = await app.request('/api/schedule/recurring', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { res, body: (await res.json()) as ScheduleResponse }
}

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
      expect(body.recurrence).not.toBeNull()
      expect(body.recurrence!.type).toBe('weekly')
      expect(body.recurrence!.daysOfWeek).toEqual([1, 3, 5])
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

      const blocks = (await res.json()) as ExpandedBlock[]
      expect(blocks).toHaveLength(1)
      expect(blocks[0]!.title).toBe('Morning Routine')
      expect(blocks[0]!.start).toBe('2026-03-22T06:00:00')
      expect(blocks[0]!.end).toBe('2026-03-22T07:00:00')
    })

    it('returns cross-midnight blocks correctly', async () => {
      await createSchedule({
        title: 'Sleep',
        startTime: '23:00',
        endTime: '07:00',
      })

      const res = await app.request('/api/schedule/recurring?date=2026-03-22')
      expect(res.status).toBe(200)

      const blocks = (await res.json()) as ExpandedBlock[]
      // Should have both start portion and end portion for the same day
      // (since no recurrence rule means it matches every day)
      expect(blocks).toHaveLength(2)

      const startBlock = blocks.find((b) => b.start.includes('T23:00'))
      expect(startBlock).toBeDefined()
      expect(startBlock!.end).toBe('2026-03-23T00:00:00')

      const endBlock = blocks.find((b) => b.start.includes('T00:00'))
      expect(endBlock).toBeDefined()
      expect(endBlock!.end).toBe('2026-03-22T07:00:00')
    })

    it('filters by weekly recurrence rule', async () => {
      await createSchedule({
        title: 'Gym',
        startTime: '18:00',
        endTime: '19:00',
        recurrence: {
          type: 'weekly',
          interval: 1,
          daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
        },
      })

      // 2026-03-23 is Monday
      const mondayRes = await app.request(
        '/api/schedule/recurring?date=2026-03-23',
      )
      const mondayBlocks = (await mondayRes.json()) as ExpandedBlock[]
      expect(mondayBlocks).toHaveLength(1)

      // 2026-03-24 is Tuesday
      const tuesdayRes = await app.request(
        '/api/schedule/recurring?date=2026-03-24',
      )
      const tuesdayBlocks = (await tuesdayRes.json()) as ExpandedBlock[]
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
      const body = (await res.json()) as ScheduleResponse
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
      const body = (await res.json()) as ScheduleResponse
      expect(body.recurrence).not.toBeNull()
      expect(body.recurrence!.type).toBe('weekly')
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
      const body = (await res.json()) as ScheduleResponse
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
      const blocks = (await getRes.json()) as ExpandedBlock[]
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
