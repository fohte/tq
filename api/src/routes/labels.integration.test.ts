import { describe, expect, it } from 'vitest'

import { app } from '#app'
import { createLabel, createTask } from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000'

interface LabelResponse {
  id: string
  name: string
  color: string | null
  context: string
  createdAt: string
}

describe('labels API', () => {
  describe('GET /api/labels/counts', () => {
    it.each([undefined, 'invalid'])(
      'requires a valid context (%s)',
      async (context) => {
        const url =
          context === undefined
            ? '/api/labels/counts'
            : `/api/labels/counts?context=${context}`
        const res = await app.request(url)

        expect(res.status).toBe(400)
      },
    )

    it('counts active tasks per assigned label path in the label context', async () => {
      await createLabel('team', { context: 'work' })
      await createLabel('team/api', { context: 'work' })
      await createLabel('completed-only', { context: 'work' })
      await createLabel('personal-only', { context: 'personal' })
      await createLabel('unassigned', { context: 'work' })

      await createTask('parent and child labels', {
        context: 'personal',
        labels: ['team', 'team/api', 'personal-only'],
      })
      await createTask('child label', {
        context: 'personal',
        labels: ['team/api'],
      })
      const completedTask = await createTask('completed label', {
        labels: ['completed-only'],
      })
      await app.request(`/api/tasks/${completedTask.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })

      const res = await app.request('/api/labels/counts?context=work')

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([
        { name: 'completed-only', count: 0 },
        { name: 'team', count: 2 },
        { name: 'team/api', count: 2 },
      ])
    })
  })

  describe('GET /api/labels', () => {
    it('returns empty list when no labels exist', async () => {
      const res = await app.request('/api/labels')

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([])
    })

    it('returns labels ordered by name', async () => {
      await createLabel('urgent')
      await createLabel('bug')

      const res = await app.request('/api/labels')

      expect(res.status).toBe(200)
      const body = await jsonBody<LabelResponse[]>(res)
      expect(body.map((label) => label.name)).toEqual(['bug', 'urgent'])
    })

    it('filters by context', async () => {
      await createLabel('personal-label')
      const workLabel = await createLabel('work-label', { context: 'work' })

      const res = await app.request('/api/labels?context=work')

      expect(res.status).toBe(200)
      const body = await jsonBody<LabelResponse[]>(res)
      expect(body).toEqual([
        {
          id: workLabel.id,
          name: workLabel.name,
          color: workLabel.color,
          context: workLabel.context,
          createdAt: workLabel.createdAt.toISOString(),
        },
      ])
    })
  })

  describe('PATCH /api/labels/:id', () => {
    it('renames a label', async () => {
      const label = await createLabel('bug')

      const res = await app.request(`/api/labels/${label.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'defect' }),
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<LabelResponse>(res)
      expect(body).toEqual({
        id: label.id,
        name: 'defect',
        color: label.color,
        context: label.context,
        createdAt: label.createdAt.toISOString(),
      })
    })

    it('changes a label context', async () => {
      const label = await createLabel('urgent', { context: 'personal' })

      const res = await app.request(`/api/labels/${label.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: 'work' }),
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<LabelResponse>(res)
      expect(body).toEqual({
        id: label.id,
        name: label.name,
        color: label.color,
        context: 'work',
        createdAt: label.createdAt.toISOString(),
      })
    })

    it('returns 409 when renaming to a name already in use', async () => {
      await createLabel('bug')
      const other = await createLabel('urgent')

      const res = await app.request(`/api/labels/${other.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'bug' }),
      })

      expect(res.status).toBe(409)
    })

    it('allows renaming a label to its own current name', async () => {
      const label = await createLabel('bug')

      const res = await app.request(`/api/labels/${label.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'bug' }),
      })

      expect(res.status).toBe(200)
    })

    it.each(['dev/', '/tq', 'dev//tq'])(
      'returns 400 when renaming to a name with an empty path segment (%s)',
      async (name) => {
        const label = await createLabel('bug')

        const res = await app.request(`/api/labels/${label.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        })

        expect(res.status).toBe(400)
      },
    )

    it('allows renaming to a hierarchical path name', async () => {
      const label = await createLabel('bug')

      const res = await app.request(`/api/labels/${label.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'dev/tq' }),
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<LabelResponse>(res)
      expect(body).toEqual({
        id: label.id,
        name: 'dev/tq',
        color: label.color,
        context: label.context,
        createdAt: label.createdAt.toISOString(),
      })
    })

    it('returns 400 when no fields are given', async () => {
      const label = await createLabel('bug')

      const res = await app.request(`/api/labels/${label.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(400)
    })

    it('returns 404 for non-existent label', async () => {
      const res = await app.request(`/api/labels/${TEST_UUID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'renamed' }),
      })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/labels/:id', () => {
    it('deletes a label', async () => {
      const label = await createLabel('bug')

      const res = await app.request(`/api/labels/${label.id}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(204)

      const listRes = await app.request('/api/labels')
      expect(await listRes.json()).toEqual([])
    })

    it('returns 404 for non-existent label', async () => {
      const res = await app.request(`/api/labels/${TEST_UUID}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(404)
    })
  })
})
