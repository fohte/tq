import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { app } from '#app'
import {
  callMcpTool,
  connectMcpClient,
  parseToolJson,
} from '#routes/mcp/testing'
import {
  createPage,
  createTask,
  TEST_UUID,
  withoutLinkSync,
} from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

let client: Client

beforeEach(async () => {
  client = await connectMcpClient()
})

afterEach(async () => {
  await client.close()
})

it('declares task read tools as read-only', async () => {
  const result = await client.listTools()

  expect(
    result.tools
      .filter((tool) =>
        ['get_task', 'list_tasks', 'search_tasks'].includes(tool.name),
      )
      .map((tool) => ({
        name: tool.name,
        readOnlyHint: tool.annotations?.readOnlyHint,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  ).toEqual([
    { name: 'get_task', readOnlyHint: true },
    { name: 'list_tasks', readOnlyHint: true },
    { name: 'search_tasks', readOnlyHint: true },
  ])
})

describe('list_tasks', () => {
  it('rejects invalid input', async () => {
    const result = await callMcpTool(client, 'list_tasks', {
      projectId: 'not-a-uuid',
    })

    expect(result.isError).toBe(true)
  })

  it('returns tasks matching the given filters', async () => {
    const task = await createTask('Work task', { context: 'work' })
    await createTask('Personal task')

    const toolResult = await callMcpTool(client, 'list_tasks', {
      context: 'work',
    })

    expect(parseToolJson(toolResult)).toEqual([
      {
        ...withoutLinkSync(task),
        parentNumber: null,
        duplicateOfNumber: null,
        blockedByNumbers: [],
        labels: [],
        childCompletionCount: { total: 0, completed: 0 },
      },
    ])
  })

  it('returns only root tasks when parentId is "root"', async () => {
    const parent = await createTask('Parent')
    await createTask('Child', { parentId: parent.id })

    const toolResult = await callMcpTool(client, 'list_tasks', {
      parentId: 'root',
    })

    expect(parseToolJson(toolResult)).toEqual([
      {
        ...withoutLinkSync(parent),
        parentNumber: null,
        duplicateOfNumber: null,
        blockedByNumbers: [],
        labels: [],
        childCompletionCount: { total: 1, completed: 0 },
      },
    ])
  })
})

describe('get_task', () => {
  it('rejects invalid input', async () => {
    const result = await callMcpTool(client, 'get_task', {
      taskId: 'not-a-uuid',
    })

    expect(result.isError).toBe(true)
  })

  it('merges the task detail with its subtask tree', async () => {
    const parent = await createTask('Parent')
    const child = await createTask('Child', { parentId: parent.id })

    const toolResult = await callMcpTool(client, 'get_task', {
      taskId: parent.id,
    })

    expect(parseToolJson(toolResult)).toEqual({
      ...withoutLinkSync(parent),
      titleAuthor: { kind: 'human', agent: null },
      descriptionAuthor: { kind: 'human', agent: null },
      childCompletionCount: { total: 1, completed: 0 },
      pages: [],
      timeBlocks: [],
      links: { outgoing: [], incoming: [] },
      labels: [],
      parentNumber: null,
      duplicateOfNumber: null,
      duplicateOfTask: null,
      blockedBy: [],
      blocking: [],
      subtasks: [
        {
          ...withoutLinkSync(child),
          parentNumber: parent.number,
          duplicateOfNumber: null,
          blockedByNumbers: [],
          children: [],
          childCompletionCount: { total: 0, completed: 0 },
        },
      ],
    })
  })

  it('maps a non-existent task id to a 404 error result', async () => {
    const result = await callMcpTool(client, 'get_task', { taskId: TEST_UUID })

    expect(result).toEqual({
      content: [{ type: 'text', text: 'Task not found' }],
      isError: true,
    })
  })

  it('returns page metadata without content', async () => {
    const task = await createTask('Task with notes')
    const created = await createPage(
      task.id,
      'Investigation notes',
      'note body',
    )
    const pageRes = await app.request(
      `/api/tasks/${task.id}/pages/${created.id}`,
    )
    const page = await jsonBody<{
      id: string
      taskId: string
      title: string
      format: string
      sortOrder: number
      createdAt: string
      updatedAt: string
      author: unknown
    }>(pageRes)

    const toolResult = await callMcpTool(client, 'get_task', {
      taskId: task.id,
    })

    expect(parseToolJson(toolResult)).toEqual({
      ...withoutLinkSync(task),
      titleAuthor: { kind: 'human', agent: null },
      descriptionAuthor: { kind: 'human', agent: null },
      childCompletionCount: { total: 0, completed: 0 },
      pages: [
        {
          id: page.id,
          taskId: page.taskId,
          title: page.title,
          format: page.format,
          sortOrder: page.sortOrder,
          createdAt: page.createdAt,
          updatedAt: page.updatedAt,
          author: page.author,
        },
      ],
      timeBlocks: [],
      links: { outgoing: [], incoming: [] },
      labels: [],
      parentNumber: null,
      duplicateOfNumber: null,
      duplicateOfTask: null,
      blockedBy: [],
      blocking: [],
      subtasks: [],
    })
  })
})

describe('search_tasks', () => {
  it('rejects invalid input', async () => {
    const result = await callMcpTool(client, 'search_tasks', { limit: 0 })

    expect(result.isError).toBe(true)
  })

  it('returns tasks matching the free-text query', async () => {
    const match = await createTask('Deploy to production')
    await createTask('Buy groceries')

    const toolResult = await callMcpTool(client, 'search_tasks', {
      q: 'deploy',
    })

    expect(parseToolJson(toolResult)).toEqual([
      {
        ...withoutLinkSync(match),
        parentNumber: null,
        duplicateOfNumber: null,
        blockedByNumbers: [],
        childCompletionCount: { total: 0, completed: 0 },
      },
    ])
  })

  it('translates hasEstimate into the REST string param', async () => {
    await createTask('With estimate', { estimatedMinutes: 30 })
    const withoutEstimate = await createTask('Without estimate')

    const toolResult = await callMcpTool(client, 'search_tasks', {
      hasEstimate: false,
    })

    expect(parseToolJson(toolResult)).toEqual([
      {
        ...withoutLinkSync(withoutEstimate),
        parentNumber: null,
        duplicateOfNumber: null,
        blockedByNumbers: [],
        childCompletionCount: { total: 0, completed: 0 },
      },
    ])
  })

  it('translates hasDue into the REST string param', async () => {
    const withDue = await createTask('With due date', {
      dueDate: '2026-02-01',
    })
    await createTask('Without due date')

    const toolResult = await callMcpTool(client, 'search_tasks', {
      hasDue: true,
    })

    expect(parseToolJson(toolResult)).toEqual([
      {
        ...withoutLinkSync(withDue),
        parentNumber: null,
        duplicateOfNumber: null,
        blockedByNumbers: [],
        childCompletionCount: { total: 0, completed: 0 },
      },
    ])
  })
})
