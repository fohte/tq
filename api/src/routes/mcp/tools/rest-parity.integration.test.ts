import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { app } from '#app'
import {
  callMcpTool,
  connectMcpClient,
  parseToolJson,
} from '#routes/mcp/testing'
import {
  createTask,
  type TaskResponse,
  withoutRecurrenceRule,
} from '#routes/tasks/testing'
import {
  assertDefined,
  jsonBody,
  passthroughSchema,
  setupTestDb,
} from '#testing'

setupTestDb()

// These tests confirm that data written through an MCP write tool is visible,
// in the same shape, through the plain REST routes the web UI reads from —
// not the MCP read tools (read-tools.integration.test.ts) and not the write
// tool's own response (write-tools.integration.test.ts).

type CompletedTaskResponse = TaskResponse & {
  nextTask: TaskResponse | null
}

let client: Client

beforeEach(async () => {
  client = await connectMcpClient()
})

afterEach(async () => {
  await client.close()
})

async function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  return callMcpTool(client, name, args)
}

async function completeRecurringTask(): Promise<{
  completedTask: TaskResponse
  nextTask: TaskResponse
}> {
  const created = await callTool('create_task', {
    title: 'Recurring via MCP',
    dueDate: '2026-03-22',
    recurrenceRule: { type: 'daily', interval: 1 },
  })
  const createdData = passthroughSchema<TaskResponse>().parse(
    parseToolJson(created),
  )

  const completed = await callTool('update_task_status', {
    taskId: createdData.id,
    status: 'completed',
  })
  const completedResult = passthroughSchema<CompletedTaskResponse>().parse(
    parseToolJson(completed),
  )
  assertDefined(
    completedResult.nextTask,
    'expected a next task to be generated',
  )

  return {
    completedTask: {
      ...createdData,
      status: 'completed',
      updatedAt: completedResult.updatedAt,
    },
    nextTask: completedResult.nextTask,
  }
}

describe('REST/MCP parity', () => {
  it('a task created via create_task is visible through GET /api/tasks/:id', async () => {
    const created = await callTool('create_task', {
      title: 'Write and read back',
      context: 'work',
    })
    const data = passthroughSchema<TaskResponse>().parse(parseToolJson(created))

    const res = await app.request(`/api/tasks/${data.id}`)
    expect(res.status).toBe(200)

    expect(await jsonBody(res)).toEqual({
      ...data,
      titleAuthor: { kind: 'llm', agent: 'mcp' },
      descriptionAuthor: { kind: 'llm', agent: 'mcp' },
      childCompletionCount: { total: 0, completed: 0 },
      pages: [],
      timeBlocks: [],
      links: { outgoing: [], incoming: [] },
      labels: [],
    })
  })

  it('a task created via create_task with an explicit agent is attributed to that agent through GET /api/tasks/:id', async () => {
    const created = await callTool('create_task', {
      title: 'Attributed via MCP',
      agent: 'claude-opus-5',
    })
    const data = passthroughSchema<TaskResponse>().parse(parseToolJson(created))

    const res = await app.request(`/api/tasks/${data.id}`)
    expect(res.status).toBe(200)

    expect(await jsonBody(res)).toEqual({
      ...data,
      titleAuthor: { kind: 'llm', agent: 'claude-opus-5' },
      descriptionAuthor: { kind: 'llm', agent: 'claude-opus-5' },
      childCompletionCount: { total: 0, completed: 0 },
      pages: [],
      timeBlocks: [],
      links: { outgoing: [], incoming: [] },
      labels: [],
    })
  })

  it('a task created via create_task is visible through GET /api/tasks (list)', async () => {
    const created = await callTool('create_task', {
      title: 'Listed via MCP',
      context: 'work',
    })
    const data = passthroughSchema<TaskResponse>().parse(parseToolJson(created))

    const res = await app.request('/api/tasks?context=work')
    expect(res.status).toBe(200)

    expect(await jsonBody<unknown[]>(res)).toEqual([
      { ...withoutRecurrenceRule(data), parentNumber: null, labels: [] },
    ])
  })

  it('a title updated via update_task is visible through GET /api/tasks/:id', async () => {
    const task = await createTask('Original title')

    const updated = await callTool('update_task', {
      taskId: task.id,
      title: 'Updated via MCP',
    })
    const data = passthroughSchema<TaskResponse>().parse(parseToolJson(updated))

    const res = await app.request(`/api/tasks/${task.id}`)
    expect(res.status).toBe(200)

    expect(await jsonBody(res)).toEqual({
      ...data,
      titleAuthor: { kind: 'llm', agent: 'mcp' },
      descriptionAuthor: { kind: 'human', agent: null },
      childCompletionCount: { total: 0, completed: 0 },
      pages: [],
      timeBlocks: [],
      links: { outgoing: [], incoming: [] },
      labels: [],
    })
  })

  it('labels replaced via update_task, including newly created ones, are visible through GET /api/tasks/:id', async () => {
    const task = await createTask('Needs a label', { labels: ['urgent'] })

    const updated = await callTool('update_task', {
      taskId: task.id,
      labels: ['urgent', 'new-label'],
    })
    const data = passthroughSchema<TaskResponse>().parse(parseToolJson(updated))

    const res = await app.request(`/api/tasks/${task.id}`)
    expect(res.status).toBe(200)

    const body = await jsonBody<TaskResponse>(res)
    body.labels = body.labels.toSorted()

    expect(body).toEqual({
      ...data,
      titleAuthor: { kind: 'human', agent: null },
      descriptionAuthor: { kind: 'human', agent: null },
      childCompletionCount: { total: 0, completed: 0 },
      pages: [],
      timeBlocks: [],
      links: { outgoing: [], incoming: [] },
      labels: data.labels.toSorted(),
    })
  })

  it('setting a task to in_progress via update_task_status is visible through GET /api/tasks/:id', async () => {
    const task = await createTask('Start via MCP')

    const started = await callTool('update_task_status', {
      taskId: task.id,
      status: 'in_progress',
    })
    const data = passthroughSchema<TaskResponse>().parse(parseToolJson(started))

    const res = await app.request(`/api/tasks/${task.id}`)
    expect(res.status).toBe(200)

    expect(await jsonBody(res)).toEqual({
      ...data,
      titleAuthor: { kind: 'human', agent: null },
      descriptionAuthor: { kind: 'human', agent: null },
      childCompletionCount: { total: 0, completed: 0 },
      pages: [],
      timeBlocks: [],
      links: { outgoing: [], incoming: [] },
      labels: [],
    })
  })

  it('completing a recurring task via update_task_status generates a next occurrence visible through GET /api/tasks (list)', async () => {
    const { completedTask, nextTask } = await completeRecurringTask()

    const res = await app.request('/api/tasks?context=personal')
    expect(res.status).toBe(200)

    const byId = (a: { id: string }, b: { id: string }) =>
      a.id.localeCompare(b.id)
    const expected = [
      {
        ...withoutRecurrenceRule(completedTask),
        parentNumber: null,
        labels: [],
      },
      {
        ...withoutRecurrenceRule(nextTask),
        parentNumber: null,
        labels: [],
      },
    ]

    // GET /api/tasks (list) has no recurrenceRule key at all, unlike the
    // detail endpoint and this write tool's own response. Sorting both sides
    // by id avoids depending on the unspecified tie-break order Postgres
    // uses when createdAt is identical for both tasks.
    expect((await jsonBody<{ id: string }[]>(res)).sort(byId)).toEqual(
      expected.sort(byId),
    )
  })

  it('completing a recurring task via update_task_status generates a next occurrence visible through GET /api/tasks/:id', async () => {
    const { nextTask } = await completeRecurringTask()

    const res = await app.request(`/api/tasks/${nextTask.id}`)
    expect(res.status).toBe(200)

    expect(await jsonBody(res)).toEqual({
      ...nextTask,
      titleAuthor: { kind: 'system', agent: null },
      descriptionAuthor: { kind: 'system', agent: null },
      childCompletionCount: { total: 0, completed: 0 },
      pages: [],
      timeBlocks: [],
      links: { outgoing: [], incoming: [] },
      labels: [],
    })
  })

  it('a page created via create_page is visible through GET /api/tasks/:taskId/pages', async () => {
    const task = await createTask('Has pages')

    const created = await callTool('create_page', {
      taskId: task.id,
      title: 'Notes',
      content: 'Some content',
    })
    const data = parseToolJson(created)

    const res = await app.request(`/api/tasks/${task.id}/pages`)
    expect(res.status).toBe(200)

    expect(await jsonBody(res)).toEqual([data])
  })

  it('a page updated via update_page with an explicit agent is attributed to that agent through GET /api/tasks/:taskId/pages', async () => {
    const task = await createTask('Has pages')
    const created = await callTool('create_page', {
      taskId: task.id,
      title: 'Notes',
    })
    const page = passthroughSchema<{ id: string }>().parse(
      parseToolJson(created),
    )

    const updated = await callTool('update_page', {
      taskId: task.id,
      pageId: page.id,
      content: 'Updated content',
      agent: 'claude-opus-5',
    })
    const data = parseToolJson(updated)

    const res = await app.request(`/api/tasks/${task.id}/pages`)
    expect(res.status).toBe(200)

    expect(await jsonBody(res)).toEqual([data])
  })

  it('a comment created via create_comment is visible through GET /api/tasks/:taskId/comments', async () => {
    const task = await createTask('Has comments')

    const created = await callTool('create_comment', {
      taskId: task.id,
      content: 'A comment',
    })
    const data = parseToolJson(created)

    const res = await app.request(`/api/tasks/${task.id}/comments`)
    expect(res.status).toBe(200)

    expect(await jsonBody(res)).toEqual([data])
  })

  it('a comment updated via update_comment with an explicit agent is attributed to that agent through GET /api/tasks/:taskId/comments', async () => {
    const task = await createTask('Has comments')
    const created = await callTool('create_comment', {
      taskId: task.id,
      content: 'Original content',
    })
    const comment = passthroughSchema<{ id: string }>().parse(
      parseToolJson(created),
    )

    const updated = await callTool('update_comment', {
      taskId: task.id,
      commentId: comment.id,
      content: 'Updated content',
      agent: 'claude-opus-5',
    })
    const data = parseToolJson(updated)

    const res = await app.request(`/api/tasks/${task.id}/comments`)
    expect(res.status).toBe(200)

    expect(await jsonBody(res)).toEqual([data])
  })
})
