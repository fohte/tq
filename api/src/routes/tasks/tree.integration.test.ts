/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { app } from '@api/app'
import { createTask, TaskResponse, TEST_UUID } from '@api/routes/tasks/testing'
import { setupTestDb } from '@api/testing'
import { describe, expect, it } from 'vitest'

setupTestDb()

describe('tasks tree API', () => {
  describe('GET /api/tasks/tree', () => {
    it('returns empty array when no tasks', async () => {
      const res = await app.request('/api/tasks/tree')

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([])
    })

    it('returns tree structure with children', async () => {
      const parent = await createTask('Parent')
      await createTask('Child 1', { parentId: parent.id })
      await createTask('Child 2', { parentId: parent.id })

      const res = await app.request('/api/tasks/tree')

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse[]
      expect(body).toHaveLength(1)
      expect(body[0]!.title).toBe('Parent')
      expect(body[0]!.children).toHaveLength(2)
      expect(body[0]!.childCompletionCount!.total).toBe(2)
    })

    it('returns subtree for rootId', async () => {
      const root = await createTask('Root')
      const child = await createTask('Child', { parentId: root.id })
      await createTask('Grandchild', { parentId: child.id })
      await createTask('Unrelated')

      const res = await app.request(`/api/tasks/tree?rootId=${root.id}`)

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse[]
      expect(body).toHaveLength(1)
      expect(body[0]!.title).toBe('Root')
      expect(body[0]!.children).toHaveLength(1)
      expect(body[0]!.children![0]!.title).toBe('Child')
      expect(body[0]!.children![0]!.children).toHaveLength(1)
      expect(body[0]!.children![0]!.children![0]!.title).toBe('Grandchild')
    })

    it('returns deeply nested tree (3+ levels)', async () => {
      const level1 = await createTask('Level 1')
      const level2 = await createTask('Level 2', { parentId: level1.id })
      const level3 = await createTask('Level 3', { parentId: level2.id })
      await createTask('Level 4', { parentId: level3.id })

      const res = await app.request('/api/tasks/tree')

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse[]
      expect(body).toHaveLength(1)
      expect(body[0]!.children![0]!.children![0]!.children).toHaveLength(1)
      expect(body[0]!.children![0]!.children![0]!.children![0]!.title).toBe(
        'Level 4',
      )
    })

    it('returns empty array for non-existent rootId', async () => {
      await createTask('Task')

      const res = await app.request(`/api/tasks/tree?rootId=${TEST_UUID}`)

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([])
    })

    it('includes childCompletionCount in tree nodes', async () => {
      const parent = await createTask('Parent')
      await createTask('Child 1', { parentId: parent.id })
      const child2 = await createTask('Child 2', { parentId: parent.id })
      await createTask('Child 3', { parentId: parent.id })

      await app.request(`/api/tasks/${child2.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })

      const res = await app.request('/api/tasks/tree')

      expect(res.status).toBe(200)
      const body = (await res.json()) as TaskResponse[]
      expect(body[0]!.childCompletionCount).toEqual({
        completed: 1,
        total: 3,
      })
    })
  })
})
