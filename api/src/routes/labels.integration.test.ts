import { describe, expect, it } from 'vitest'

import { app } from '#app'
import { createLabel } from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

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
})
