import { afterEach, describe, expect, it, vi } from 'vitest'

import { app } from '#app'
import {
  createLabel,
  createTask,
  TaskResponse,
  TEST_UUID,
} from '#routes/tasks/testing'
import { assertDefined, jsonBody, setupTestDb } from '#testing'

setupTestDb()

afterEach(() => {
  vi.useRealTimers()
})

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
      const body = await jsonBody<TaskResponse[]>(res)
      expect(body).toHaveLength(1)
      assertDefined(body[0])
      expect(body[0].title).toBe('Parent')
      expect(body[0].children).toHaveLength(2)
      assertDefined(body[0].childCompletionCount)
      expect(body[0].childCompletionCount.total).toBe(2)
    })

    it('returns subtree for rootId', async () => {
      const root = await createTask('Root')
      const child = await createTask('Child', { parentId: root.id })
      await createTask('Grandchild', { parentId: child.id })
      await createTask('Unrelated')

      const res = await app.request(`/api/tasks/tree?rootId=${root.id}`)

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse[]>(res)
      expect(body).toHaveLength(1)
      assertDefined(body[0])
      expect(body[0].title).toBe('Root')
      assertDefined(body[0].children)
      expect(body[0].children).toHaveLength(1)
      assertDefined(body[0].children[0])
      expect(body[0].children[0].title).toBe('Child')
      assertDefined(body[0].children[0].children)
      expect(body[0].children[0].children).toHaveLength(1)
      assertDefined(body[0].children[0].children[0])
      expect(body[0].children[0].children[0].title).toBe('Grandchild')
    })

    it('returns deeply nested tree (3+ levels)', async () => {
      const level1 = await createTask('Level 1')
      const level2 = await createTask('Level 2', { parentId: level1.id })
      const level3 = await createTask('Level 3', { parentId: level2.id })
      await createTask('Level 4', { parentId: level3.id })

      const res = await app.request('/api/tasks/tree')

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse[]>(res)
      expect(body).toHaveLength(1)
      assertDefined(body[0])
      assertDefined(body[0].children)
      assertDefined(body[0].children[0])
      assertDefined(body[0].children[0].children)
      assertDefined(body[0].children[0].children[0])
      assertDefined(body[0].children[0].children[0].children)
      expect(body[0].children[0].children[0].children).toHaveLength(1)
      assertDefined(body[0].children[0].children[0].children[0])
      expect(body[0].children[0].children[0].children[0].title).toBe('Level 4')
    })

    it('returns empty array for non-existent rootId', async () => {
      await createTask('Task')

      const res = await app.request(`/api/tasks/tree?rootId=${TEST_UUID}`)

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([])
    })

    it('includes labels in each tree node', async () => {
      await createLabel('urgent')
      await createLabel('bug')
      const parent = await createTask('Parent', { labels: ['urgent'] })
      const child = await createTask('Child', {
        parentId: parent.id,
        labels: ['bug'],
      })

      const res = await app.request('/api/tasks/tree')
      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse[]>(res)
      assertDefined(body[0])
      assertDefined(body[0].children)
      assertDefined(body[0].children[0])
      const nodes = [body[0], body[0].children[0]].map((n) => [n.id, n.labels])

      expect(nodes).toEqual([
        [parent.id, ['urgent']],
        [child.id, ['bug']],
      ])
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
      const body = await jsonBody<TaskResponse[]>(res)
      assertDefined(body[0])
      expect(body[0].childCompletionCount).toEqual({
        completed: 1,
        total: 3,
      })
    })

    it('sorts sibling nodes by updatedAt descending when sortBy=updated', async () => {
      const parent = await createTask('Parent')
      const childA = await createTask('Child A', { parentId: parent.id })
      const childB = await createTask('Child B', { parentId: parent.id })
      const childC = await createTask('Child C', { parentId: parent.id })

      // See crud.integration.test.ts's analogous test for why every sibling
      // needs a distinct, explicitly-patched `updatedAt`: all three share the
      // same DB-default timestamp from this test's transaction start, so an
      // unpatched sibling would tie with another and make `ORDER BY
      // updated_at DESC` arbitrary between them.
      const patchWithFakeTime = async (
        taskId: string,
        title: string,
        time: string,
      ) => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date(time))
        const res = await app.request(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        })
        vi.useRealTimers()
        expect(res.status).toBe(200)
      }

      await patchWithFakeTime(childA.id, 'Child A', '2030-01-01T00:00:00.000Z')
      await patchWithFakeTime(childC.id, 'Child C', '2030-01-02T00:00:00.000Z')
      await patchWithFakeTime(
        childB.id,
        'Child B (updated)',
        '2030-01-03T00:00:00.000Z',
      )

      const res = await app.request('/api/tasks/tree?sortBy=updated')

      expect(res.status).toBe(200)
      const body = await jsonBody<TaskResponse[]>(res)
      assertDefined(body[0])
      assertDefined(body[0].children)
      expect(body[0].children.map((c) => c.title)).toEqual([
        'Child B (updated)',
        'Child C',
        'Child A',
      ])
    })
  })
})
