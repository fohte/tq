import { describe, expect, it } from 'vitest'

import { app } from '@api/app'

// RFC 4122 compliant UUIDs for testing
const TEST_ID_1 = '550e8400-e29b-41d4-a716-446655440000'
const TEST_ID_2 = 'f47ac10b-58cc-4372-a567-0d02b2c3d479'

describe('sub-app routing', () => {
  describe('tasks sub-app', () => {
    it('GET /api/tasks returns 200', async () => {
      const res = await app.request('/api/tasks')
      expect(res.status).toBe(200)
    })

    it('POST /api/tasks validates request body', async () => {
      const res = await app.request('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(400)
    })

    it('POST /api/tasks with valid body returns 501 (skeleton)', async () => {
      const res = await app.request('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test task' }),
      })
      expect(res.status).toBe(501)
    })

    it('GET /api/tasks/tree returns 200', async () => {
      const res = await app.request('/api/tasks/tree')
      expect(res.status).toBe(200)
    })

    it('GET /api/tasks/search returns 200', async () => {
      const res = await app.request('/api/tasks/search')
      expect(res.status).toBe(200)
    })

    it('GET /api/tasks/search/suggest validates prefix', async () => {
      const res = await app.request('/api/tasks/search/suggest')
      expect(res.status).toBe(400)
    })

    it('GET /api/tasks/search/suggest with prefix returns 200', async () => {
      const res = await app.request('/api/tasks/search/suggest?prefix=is:')
      expect(res.status).toBe(200)
    })

    it('GET /api/tasks/:id returns 501 (skeleton)', async () => {
      const res = await app.request(`/api/tasks/${TEST_ID_1}`)
      expect(res.status).toBe(501)
    })

    it('PATCH /api/tasks/:id/status validates status', async () => {
      const res = await app.request(`/api/tasks/${TEST_ID_1}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'invalid' }),
      })
      expect(res.status).toBe(400)
    })

    it('PATCH /api/tasks/:id/parent accepts valid parentId', async () => {
      const res = await app.request(`/api/tasks/${TEST_ID_1}/parent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: TEST_ID_2 }),
      })
      expect(res.status).toBe(501)
    })

    it('DELETE /api/tasks/:id returns 501 (skeleton)', async () => {
      const res = await app.request(`/api/tasks/${TEST_ID_1}`, {
        method: 'DELETE',
      })
      expect(res.status).toBe(501)
    })
  })

  describe('projects sub-app', () => {
    it('GET /api/projects returns 200', async () => {
      const res = await app.request('/api/projects')
      expect(res.status).toBe(200)
    })

    it('POST /api/projects validates request body', async () => {
      const res = await app.request('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(400)
    })

    it('POST /api/projects with valid body returns 501 (skeleton)', async () => {
      const res = await app.request('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test project' }),
      })
      expect(res.status).toBe(501)
    })

    it('GET /api/projects/:id/tasks returns 200', async () => {
      const res = await app.request(`/api/projects/${TEST_ID_1}/tasks`)
      expect(res.status).toBe(200)
    })
  })

  describe('schedule sub-app', () => {
    it('GET /api/schedule/time-blocks requires date', async () => {
      const res = await app.request('/api/schedule/time-blocks')
      expect(res.status).toBe(400)
    })

    it('GET /api/schedule/time-blocks with date returns 200', async () => {
      const res = await app.request('/api/schedule/time-blocks?date=2026-03-18')
      expect(res.status).toBe(200)
    })

    it('PUT /api/schedule/today-tasks accepts taskIds', async () => {
      const res = await app.request('/api/schedule/today-tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: [] }),
      })
      expect(res.status).toBe(200)
    })

    it('POST /api/schedule/auto-assign accepts date', async () => {
      const res = await app.request('/api/schedule/auto-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: '2026-03-18' }),
      })
      expect(res.status).toBe(200)
    })

    it('POST /api/schedule/recurring validates request body', async () => {
      const res = await app.request('/api/schedule/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(400)
    })

    it('GET /api/schedule/recurring requires date', async () => {
      const res = await app.request('/api/schedule/recurring')
      expect(res.status).toBe(400)
    })

    it('GET /api/schedule/recurring with date returns 200', async () => {
      const res = await app.request('/api/schedule/recurring?date=2026-03-18')
      expect(res.status).toBe(200)
    })
  })

  describe('calendar sub-app', () => {
    it('GET /api/calendar/events validates query params', async () => {
      const res = await app.request('/api/calendar/events')
      expect(res.status).toBe(400)
    })

    it('GET /api/calendar/auth-url returns 501 (skeleton)', async () => {
      const res = await app.request('/api/calendar/auth-url')
      expect(res.status).toBe(501)
    })

    it('GET /api/calendar/oauth-callback returns 501 (skeleton)', async () => {
      const res = await app.request('/api/calendar/oauth-callback?code=test')
      expect(res.status).toBe(501)
    })
  })

  describe('images sub-app', () => {
    it('POST /api/images returns 501 (skeleton)', async () => {
      const res = await app.request('/api/images', { method: 'POST' })
      expect(res.status).toBe(501)
    })

    it('GET /api/images/:id returns 501 (skeleton)', async () => {
      const res = await app.request(`/api/images/${TEST_ID_1}`)
      expect(res.status).toBe(501)
    })

    it('DELETE /api/images/:id returns 501 (skeleton)', async () => {
      const res = await app.request(`/api/images/${TEST_ID_1}`, {
        method: 'DELETE',
      })
      expect(res.status).toBe(501)
    })
  })

  describe('health check still works', () => {
    it('GET /health returns 200', async () => {
      const res = await app.request('/health')
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ status: 'ok' })
    })
  })
})
