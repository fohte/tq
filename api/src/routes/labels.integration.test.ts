import { describe, expect, it } from 'vitest'

import { app } from '#app'
import { createLabel } from '#routes/tasks/testing'
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
