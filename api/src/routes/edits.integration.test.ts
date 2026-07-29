import { asc, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import { edits } from '#db/schema'
import { assertDefined, jsonBody, setupTestDb } from '#testing'

setupTestDb()

interface TaskResponse {
  id: string
  title: string
  description: string | null
}

interface PageResponse {
  id: string
  taskId: string
}

interface CommentResponse {
  id: string
  taskId: string
}

interface EditFields {
  pageId: string | null
  commentId: string | null
  action: 'create' | 'update'
  field: 'title' | 'description' | 'content' | null
  authorKind: 'human' | 'llm' | 'system'
  authorAgent: string | null
}

async function fetchEditRows(taskId: string) {
  return db
    .select()
    .from(edits)
    .where(eq(edits.taskId, taskId))
    .orderBy(asc(edits.id))
}

async function fetchEdits(taskId: string): Promise<EditFields[]> {
  const rows = await fetchEditRows(taskId)
  return rows.map((row) => ({
    pageId: row.pageId,
    commentId: row.commentId,
    action: row.action,
    field: row.field,
    authorKind: row.authorKind,
    authorAgent: row.authorAgent,
  }))
}

async function assertStatus(res: Response, expected: number) {
  if (res.status !== expected) {
    throw new Error(
      `Expected status ${String(expected)}, got ${String(res.status)}: ${await res.text()}`,
    )
  }
}

async function createTask(
  title: string,
  opts: {
    headers?: Record<string, string>
    description?: string
    dueDate?: string
    recurrenceRule?: {
      type: string
      interval: number
      daysOfWeek?: number[]
      dayOfMonth?: number
    }
  } = {},
) {
  const { headers, ...body } = opts
  const res = await app.request('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ title, ...body }),
  })
  await assertStatus(res, 201)
  return jsonBody<TaskResponse>(res)
}

async function patchTask(
  taskId: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  const res = await app.request(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  await assertStatus(res, 200)
  return jsonBody<TaskResponse>(res)
}

async function createPage(taskId: string, title: string) {
  const res = await app.request(`/api/tasks/${taskId}/pages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  await assertStatus(res, 201)
  return jsonBody<PageResponse>(res)
}

async function createComment(taskId: string, content: string) {
  const res = await app.request(`/api/tasks/${taskId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  await assertStatus(res, 201)
  return jsonBody<CommentResponse>(res)
}

describe('edit log', () => {
  describe('X-Author header validation', () => {
    it('returns 400 for an unrecognized value', async () => {
      const res = await app.request('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Author': 'robot' },
        body: JSON.stringify({ title: 'Task' }),
      })

      expect(res.status).toBe(400)
    })

    it('returns 400 for llm: with no agent', async () => {
      const res = await app.request('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Author': 'llm:' },
        body: JSON.stringify({ title: 'Task' }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe('tasks', () => {
    it('records a human-authored create when X-Author is absent', async () => {
      const task = await createTask('Task')

      expect(await fetchEdits(task.id)).toEqual([
        {
          pageId: null,
          commentId: null,
          action: 'create',
          field: null,
          authorKind: 'human',
          authorAgent: null,
        },
      ])
    })

    it('records an llm-authored create with the agent from X-Author', async () => {
      const task = await createTask('Task', {
        headers: { 'X-Author': 'llm:claude-opus-5' },
      })

      expect(await fetchEdits(task.id)).toEqual([
        {
          pageId: null,
          commentId: null,
          action: 'create',
          field: null,
          authorKind: 'llm',
          authorAgent: 'claude-opus-5',
        },
      ])
    })

    it('records only the fields that actually changed', async () => {
      const task = await createTask('Task')

      // description stays null, so only title should be recorded
      await patchTask(task.id, {
        title: 'Updated',
        description: null,
      })

      expect(await fetchEdits(task.id)).toEqual([
        {
          pageId: null,
          commentId: null,
          action: 'create',
          field: null,
          authorKind: 'human',
          authorAgent: null,
        },
        {
          pageId: null,
          commentId: null,
          action: 'update',
          field: 'title',
          authorKind: 'human',
          authorAgent: null,
        },
      ])
    })

    it('records both title and description when both change', async () => {
      const task = await createTask('Task', { description: 'Original' })

      await patchTask(
        task.id,
        { title: 'Updated', description: 'New description' },
        { 'X-Author': 'llm:claude-opus-5' },
      )

      expect(await fetchEdits(task.id)).toEqual([
        {
          pageId: null,
          commentId: null,
          action: 'create',
          field: null,
          authorKind: 'human',
          authorAgent: null,
        },
        {
          pageId: null,
          commentId: null,
          action: 'update',
          field: 'title',
          authorKind: 'llm',
          authorAgent: 'claude-opus-5',
        },
        {
          pageId: null,
          commentId: null,
          action: 'update',
          field: 'description',
          authorKind: 'llm',
          authorAgent: 'claude-opus-5',
        },
      ])
    })

    it('records clearing a field to null as a change', async () => {
      const task = await createTask('Task', { description: 'Original' })

      await patchTask(task.id, { description: null })

      expect(await fetchEdits(task.id)).toEqual([
        {
          pageId: null,
          commentId: null,
          action: 'create',
          field: null,
          authorKind: 'human',
          authorAgent: null,
        },
        {
          pageId: null,
          commentId: null,
          action: 'update',
          field: 'description',
          authorKind: 'human',
          authorAgent: null,
        },
      ])
    })

    it('records no edit when the update does not change title or description', async () => {
      const task = await createTask('Task')

      await patchTask(task.id, { title: 'Task' })

      expect(await fetchEdits(task.id)).toEqual([
        {
          pageId: null,
          commentId: null,
          action: 'create',
          field: null,
          authorKind: 'human',
          authorAgent: null,
        },
      ])
    })
  })

  describe('task pages', () => {
    it('records create and update edits scoped to the page', async () => {
      const task = await createTask('Task')
      const page = await createPage(task.id, 'Page')

      const res = await app.request(`/api/tasks/${task.id}/pages/${page.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Author': 'llm:claude-opus-5',
        },
        body: JSON.stringify({ content: 'New content' }),
      })
      expect(res.status).toBe(200)

      const pageEdits = (await fetchEdits(task.id)).filter(
        (e) => e.pageId === page.id,
      )
      expect(pageEdits).toEqual([
        {
          pageId: page.id,
          commentId: null,
          action: 'create',
          field: null,
          authorKind: 'human',
          authorAgent: null,
        },
        {
          pageId: page.id,
          commentId: null,
          action: 'update',
          field: 'content',
          authorKind: 'llm',
          authorAgent: 'claude-opus-5',
        },
      ])
    })

    it('records no edit when the update does not change title or content', async () => {
      const task = await createTask('Task')
      const page = await createPage(task.id, 'Page')

      const res = await app.request(`/api/tasks/${task.id}/pages/${page.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: 5 }),
      })
      expect(res.status).toBe(200)

      const pageEdits = (await fetchEdits(task.id)).filter(
        (e) => e.pageId === page.id,
      )
      expect(pageEdits).toEqual([
        {
          pageId: page.id,
          commentId: null,
          action: 'create',
          field: null,
          authorKind: 'human',
          authorAgent: null,
        },
      ])
    })
  })

  describe('task comments', () => {
    it('records create and update edits scoped to the comment', async () => {
      const task = await createTask('Task')
      const comment = await createComment(task.id, 'Comment')

      const res = await app.request(
        `/api/tasks/${task.id}/comments/${comment.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'Updated comment' }),
        },
      )
      expect(res.status).toBe(200)

      const commentEdits = (await fetchEdits(task.id)).filter(
        (e) => e.commentId === comment.id,
      )
      expect(commentEdits).toEqual([
        {
          pageId: null,
          commentId: comment.id,
          action: 'create',
          field: null,
          authorKind: 'human',
          authorAgent: null,
        },
        {
          pageId: null,
          commentId: comment.id,
          action: 'update',
          field: 'content',
          authorKind: 'human',
          authorAgent: null,
        },
      ])
    })
  })

  describe('recurring task completion', () => {
    it('records the generated next task as system-authored', async () => {
      const task = await createTask('Recurring', {
        dueDate: '2026-01-01',
        recurrenceRule: { type: 'daily', interval: 1 },
      })

      const completeRes = await app.request(`/api/tasks/${task.id}/complete`, {
        method: 'POST',
      })
      await assertStatus(completeRes, 200)
      const body = await jsonBody<{ nextTask: TaskResponse | null }>(
        completeRes,
      )
      assertDefined(body.nextTask)

      expect(await fetchEdits(body.nextTask.id)).toEqual([
        {
          pageId: null,
          commentId: null,
          action: 'create',
          field: null,
          authorKind: 'system',
          authorAgent: null,
        },
      ])
    })
  })

  describe('aggregation window', () => {
    it('collapses a second edit within 10 minutes into the same row', async () => {
      const task = await createTask('Task')
      await patchTask(task.id, { title: 'First update' })

      const [titleEdit] = await fetchEditRows(task.id).then((rows) =>
        rows.filter((r) => r.field === 'title'),
      )
      assertDefined(titleEdit)
      const backdatedTo = new Date(Date.now() - 5 * 60 * 1000)
      await db
        .update(edits)
        .set({ updatedAt: backdatedTo })
        .where(eq(edits.id, titleEdit.id))

      await patchTask(task.id, { title: 'Second update' })

      const titleEditsAfter = (await fetchEditRows(task.id)).filter(
        (r) => r.field === 'title',
      )
      expect(
        titleEditsAfter.map((r) => ({
          id: r.id,
          updatedAtAdvanced: r.updatedAt.getTime() > backdatedTo.getTime(),
        })),
      ).toEqual([{ id: titleEdit.id, updatedAtAdvanced: true }])
    })

    it('starts a new row once the previous edit is older than 10 minutes', async () => {
      const task = await createTask('Task')
      await patchTask(task.id, { title: 'First update' })

      const [titleEdit] = await fetchEditRows(task.id).then((rows) =>
        rows.filter((r) => r.field === 'title'),
      )
      assertDefined(titleEdit)
      await db
        .update(edits)
        .set({ updatedAt: new Date(Date.now() - 11 * 60 * 1000) })
        .where(eq(edits.id, titleEdit.id))

      await patchTask(task.id, { title: 'Second update' })

      const titleEditsAfter = (await fetchEditRows(task.id)).filter(
        (r) => r.field === 'title',
      )
      expect(titleEditsAfter).toHaveLength(2)
    })
  })

  describe('schema constraints', () => {
    // No route ever sets both pageId and commentId (recordEdit's call sites
    // always pass at most one), so this constraint has no public-API path to
    // exercise it — inserted directly to guard the schema invariant itself.
    it('rejects an edit row that sets both pageId and commentId', async () => {
      const task = await createTask('Task')
      const page = await createPage(task.id, 'Page')
      const comment = await createComment(task.id, 'Comment')

      await expect(
        db.insert(edits).values({
          taskId: task.id,
          pageId: page.id,
          commentId: comment.id,
          action: 'create',
          authorKind: 'human',
        }),
      ).rejects.toThrow()
    })
  })
})
