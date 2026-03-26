/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { app } from '@api/app'
import { setupTestDb } from '@api/testing'
import { describe, expect, it } from 'vitest'

setupTestDb()

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000'

interface CommentResponse {
  id: string
  taskId: string
  content: string
  createdAt: string
  updatedAt: string
}

describe('task comments API', () => {
  describe('POST /api/tasks/:taskId/comments', () => {
    it('creates a comment on a task', async () => {
      const task = await createTask('My task')

      const res = await app.request(`/api/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'First comment' }),
      })

      expect(res.status).toBe(201)
      const body = (await res.json()) as CommentResponse
      expect(body.content).toBe('First comment')
      expect(body.taskId).toBe(task.id)
      expect(body.id).toBeDefined()
    })

    it('returns 404 for non-existent task', async () => {
      const res = await app.request(`/api/tasks/${TEST_UUID}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Comment' }),
      })

      expect(res.status).toBe(404)
    })

    it('returns 400 for empty content', async () => {
      const task = await createTask('My task')

      const res = await app.request(`/api/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '' }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/tasks/:taskId/comments', () => {
    it('returns empty list when no comments exist', async () => {
      const task = await createTask('My task')

      const res = await app.request(`/api/tasks/${task.id}/comments`)

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([])
    })

    it('returns comments in chronological order', async () => {
      const task = await createTask('My task')

      await createComment(task.id, 'First')
      await createComment(task.id, 'Second')
      await createComment(task.id, 'Third')

      const res = await app.request(`/api/tasks/${task.id}/comments`)

      expect(res.status).toBe(200)
      const body = (await res.json()) as CommentResponse[]
      expect(body).toHaveLength(3)
      expect(body.map((c) => c.content)).toEqual(['First', 'Second', 'Third'])
    })

    it('returns 404 for non-existent task', async () => {
      const res = await app.request(`/api/tasks/${TEST_UUID}/comments`)

      expect(res.status).toBe(404)
    })

    it('does not return comments from other tasks', async () => {
      const task1 = await createTask('Task 1')
      const task2 = await createTask('Task 2')

      await createComment(task1.id, 'Comment on task 1')
      await createComment(task2.id, 'Comment on task 2')

      const res = await app.request(`/api/tasks/${task1.id}/comments`)

      expect(res.status).toBe(200)
      const body = (await res.json()) as CommentResponse[]
      expect(body).toHaveLength(1)
      expect(body[0]!.content).toBe('Comment on task 1')
    })
  })

  describe('PATCH /api/tasks/:taskId/comments/:commentId', () => {
    it('updates a comment', async () => {
      const task = await createTask('My task')
      const comment = await createComment(task.id, 'Original')

      const res = await app.request(
        `/api/tasks/${task.id}/comments/${comment.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'Updated' }),
        },
      )

      expect(res.status).toBe(200)
      const body = (await res.json()) as CommentResponse
      expect(body.content).toBe('Updated')
    })

    it('returns 404 for non-existent comment', async () => {
      const task = await createTask('My task')

      const res = await app.request(
        `/api/tasks/${task.id}/comments/${TEST_UUID}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'Updated' }),
        },
      )

      expect(res.status).toBe(404)
    })

    it('returns 404 when comment belongs to a different task', async () => {
      const task1 = await createTask('Task 1')
      const task2 = await createTask('Task 2')
      const comment = await createComment(task1.id, 'Comment on task 1')

      const res = await app.request(
        `/api/tasks/${task2.id}/comments/${comment.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'Updated' }),
        },
      )

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/tasks/:taskId/comments/:commentId', () => {
    it('deletes a comment', async () => {
      const task = await createTask('My task')
      const comment = await createComment(task.id, 'To delete')

      const res = await app.request(
        `/api/tasks/${task.id}/comments/${comment.id}`,
        { method: 'DELETE' },
      )

      expect(res.status).toBe(204)

      const listRes = await app.request(`/api/tasks/${task.id}/comments`)
      expect((await listRes.json()) as CommentResponse[]).toEqual([])
    })

    it('returns 404 for non-existent comment', async () => {
      const task = await createTask('My task')

      const res = await app.request(
        `/api/tasks/${task.id}/comments/${TEST_UUID}`,
        { method: 'DELETE' },
      )

      expect(res.status).toBe(404)
    })
  })
})

async function createTask(title: string) {
  const res = await app.request('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (res.status !== 201) {
    throw new Error(
      `Failed to create task: ${String(res.status)} ${await res.text()}`,
    )
  }
  return (await res.json()) as { id: string }
}

async function createComment(taskId: string, content: string) {
  const res = await app.request(`/api/tasks/${taskId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (res.status !== 201) {
    throw new Error(
      `Failed to create comment: ${String(res.status)} ${await res.text()}`,
    )
  }
  return (await res.json()) as CommentResponse
}
