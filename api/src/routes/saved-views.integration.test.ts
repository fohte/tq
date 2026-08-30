import { describe, expect, it } from 'vitest'

import { app } from '#app'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000'

interface SavedViewResponse {
  id: string
  name: string
  query: string
  position: number
  context: string
  createdAt: string
  updatedAt: string
}

function normalizeSavedView(savedView: SavedViewResponse) {
  return { ...savedView, id: 'ID', createdAt: 'DATE', updatedAt: 'DATE' }
}

describe('saved views API', () => {
  describe('POST /api/saved-views', () => {
    it('creates a saved view with required fields only', async () => {
      const res = await app.request('/api/saved-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Now', query: 'commitment:active' }),
      })

      expect(res.status).toBe(201)
      const body = await jsonBody<SavedViewResponse>(res)
      expect(normalizeSavedView(body)).toEqual({
        id: 'ID',
        name: 'Now',
        query: 'commitment:active',
        position: 0,
        context: 'personal',
        createdAt: 'DATE',
        updatedAt: 'DATE',
      })
    })

    it('creates a saved view with all optional fields', async () => {
      const res = await app.request('/api/saved-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Someday',
          query: 'commitment:someday',
          position: 3,
          context: 'work',
        }),
      })

      expect(res.status).toBe(201)
      const body = await jsonBody<SavedViewResponse>(res)
      expect(normalizeSavedView(body)).toEqual({
        id: 'ID',
        name: 'Someday',
        query: 'commitment:someday',
        position: 3,
        context: 'work',
        createdAt: 'DATE',
        updatedAt: 'DATE',
      })
    })

    it('returns 400 for empty name', async () => {
      const res = await app.request('/api/saved-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '', query: 'commitment:active' }),
      })

      expect(res.status).toBe(400)
    })

    it('returns 400 for empty query', async () => {
      const res = await app.request('/api/saved-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Now', query: '' }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/saved-views', () => {
    it('returns empty list when no saved views exist', async () => {
      const res = await app.request('/api/saved-views')

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([])
    })

    it('returns saved views ordered by position', async () => {
      await createSavedView('Second', { position: 1 })
      await createSavedView('First', { position: 0 })

      const res = await app.request('/api/saved-views')

      expect(res.status).toBe(200)
      const body = await jsonBody<SavedViewResponse[]>(res)
      expect(body.map((v) => v.name)).toEqual(['First', 'Second'])
    })

    it('filters by context', async () => {
      await createSavedView('Personal view', { context: 'personal' })
      const workView = await createSavedView('Work view', { context: 'work' })

      const res = await app.request('/api/saved-views?context=work')

      expect(res.status).toBe(200)
      const body = await jsonBody<SavedViewResponse[]>(res)
      expect(body).toEqual([workView])
    })
  })

  describe('GET /api/saved-views/:id', () => {
    it('returns a saved view', async () => {
      const savedView = await createSavedView('Now')

      const res = await app.request(`/api/saved-views/${savedView.id}`)

      expect(res.status).toBe(200)
      const body = await jsonBody<SavedViewResponse>(res)
      expect(body).toEqual(savedView)
    })

    it('returns 404 for non-existent saved view', async () => {
      const res = await app.request(`/api/saved-views/${TEST_UUID}`)

      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /api/saved-views/:id', () => {
    it('updates saved view fields', async () => {
      const savedView = await createSavedView('Original')

      const res = await app.request(`/api/saved-views/${savedView.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Updated',
          query: 'commitment:someday',
          position: 2,
        }),
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<SavedViewResponse>(res)
      expect(normalizeSavedView(body)).toEqual({
        ...normalizeSavedView(savedView),
        name: 'Updated',
        query: 'commitment:someday',
        position: 2,
      })
    })

    it('returns 404 for non-existent saved view', async () => {
      const res = await app.request(`/api/saved-views/${TEST_UUID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated' }),
      })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/saved-views/:id', () => {
    it('deletes a saved view', async () => {
      const savedView = await createSavedView('To delete')

      const res = await app.request(`/api/saved-views/${savedView.id}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(204)

      const getRes = await app.request(`/api/saved-views/${savedView.id}`)
      expect(getRes.status).toBe(404)
    })

    it('returns 404 for non-existent saved view', async () => {
      const res = await app.request(`/api/saved-views/${TEST_UUID}`, {
        method: 'DELETE',
      })

      expect(res.status).toBe(404)
    })
  })
})

async function createSavedView(
  name: string,
  opts: { position?: number; context?: string } = {},
) {
  const res = await app.request('/api/saved-views', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, query: 'commitment:active', ...opts }),
  })
  if (res.status !== 201) {
    throw new Error(
      `Failed to create saved view: ${String(res.status)} ${await res.text()}`,
    )
  }
  return jsonBody<SavedViewResponse>(res)
}
