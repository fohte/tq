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
  withoutLinkSync,
} from '#routes/tasks/testing'
import { jsonBody, passthroughSchema, setupTestDb } from '#testing'

setupTestDb()

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
      ...withoutLinkSync(data),
      titleAuthor: { kind: 'llm', agent: 'mcp' },
      descriptionAuthor: { kind: 'llm', agent: 'mcp' },
      childCompletionCount: { total: 0, completed: 0 },
      pages: [],
      timeBlocks: [],
      links: { outgoing: [], incoming: [] },
      labels: [],
      parentNumber: null,
      duplicateOfNumber: null,
      duplicateOfTask: null,
      blockedBy: [],
      blocking: [],
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
      ...withoutLinkSync(data),
      titleAuthor: { kind: 'llm', agent: 'claude-opus-5' },
      descriptionAuthor: { kind: 'llm', agent: 'claude-opus-5' },
      childCompletionCount: { total: 0, completed: 0 },
      pages: [],
      timeBlocks: [],
      links: { outgoing: [], incoming: [] },
      labels: [],
      parentNumber: null,
      duplicateOfNumber: null,
      duplicateOfTask: null,
      blockedBy: [],
      blocking: [],
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
      {
        ...withoutLinkSync(data),
        parentNumber: null,
        duplicateOfNumber: null,
        blockedByNumbers: [],
        labels: [],
        childCompletionCount: { total: 0, completed: 0 },
      },
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
      parentNumber: null,
      duplicateOfNumber: null,
      duplicateOfTask: null,
      blockedBy: [],
      blocking: [],
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
      parentNumber: null,
      duplicateOfNumber: null,
      duplicateOfTask: null,
      blockedBy: [],
      blocking: [],
    })
  })

  it('setting a task to completed via update_task_status is visible through GET /api/tasks/:id', async () => {
    const task = await createTask('Complete via MCP')

    const completed = await callTool('update_task_status', {
      taskId: task.id,
      status: 'completed',
    })
    const data = passthroughSchema<TaskResponse>().parse(
      parseToolJson(completed),
    )

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
      parentNumber: null,
      duplicateOfNumber: null,
      duplicateOfTask: null,
      blockedBy: [],
      blocking: [],
    })
  })
})
