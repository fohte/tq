import { describe, expect, it } from 'vitest'

import { app } from '#app'
import { createTask } from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

describe('tasks search API', () => {
  describe('GET /api/tasks/search/suggest', () => {
    it('returns suggestions for prefix', async () => {
      const res = await app.request('/api/tasks/search/suggest?prefix=is:')

      expect(res.status).toBe(200)
      const body =
        await jsonBody<
          Array<{ value: string; display: string; category: string }>
        >(res)
      expect(body.length).toBeGreaterThan(0)
      expect(body.every((s) => s.category === 'is')).toBe(true)
    })
  })

  describe('GET /api/tasks/mentions', () => {
    type MentionSummary = {
      id: string
      number: number
      title: string
      status: string
    }

    function toMentionSummary(
      task: Awaited<ReturnType<typeof createTask>>,
    ): MentionSummary {
      return {
        id: task.id,
        number: task.number,
        title: task.title,
        status: task.status,
      }
    }

    it('matches an exact numeric query against that task number', async () => {
      const task1 = await createTask('First task')
      await createTask('Second task')

      const res = await app.request(
        `/api/tasks/mentions?q=${encodeURIComponent(String(task1.number))}`,
      )

      expect(res.status).toBe(200)
      const body = await jsonBody<MentionSummary[]>(res)
      expect(body).toEqual([toMentionSummary(task1)])
    })

    it('matches tasks whose number starts with a shorter numeric query', async () => {
      // Force the sequence to a 2+ digit number so `prefix` below is
      // genuinely shorter than the full number - this guards against the
      // endpoint regressing from a LIKE-based prefix match to an
      // exact-match comparison.
      const created: Array<Awaited<ReturnType<typeof createTask>>> = []
      let target: Awaited<ReturnType<typeof createTask>>
      do {
        target = await createTask('Number probe')
        created.push(target)
      } while (target.number < 10)

      const prefix = String(target.number).slice(0, -1)
      const expected = created
        .filter((t) => String(t.number).startsWith(prefix))
        .map(toMentionSummary)
        .sort((a, b) => a.number - b.number)

      const res = await app.request(
        `/api/tasks/mentions?q=${encodeURIComponent(prefix)}`,
      )

      expect(res.status).toBe(200)
      const body = await jsonBody<MentionSummary[]>(res)
      expect([...body].sort((a, b) => a.number - b.number)).toEqual(expected)
    })

    it('matches by title substring when q is not numeric', async () => {
      const deploy = await createTask('Deploy to production')
      await createTask('Buy groceries')

      const res = await app.request(
        '/api/tasks/mentions?q=' + encodeURIComponent('deploy'),
      )

      expect(res.status).toBe(200)
      const body = await jsonBody<MentionSummary[]>(res)
      expect(body).toEqual([toMentionSummary(deploy)])
    })

    it('returns tasks ordered by number, limited to the requested count', async () => {
      const task1 = await createTask('Task 1')
      const task2 = await createTask('Task 2')
      await createTask('Task 3')

      const res = await app.request('/api/tasks/mentions?limit=2')

      expect(res.status).toBe(200)
      const body = await jsonBody<MentionSummary[]>(res)
      expect(body).toEqual([toMentionSummary(task1), toMentionSummary(task2)])
    })
  })
})
