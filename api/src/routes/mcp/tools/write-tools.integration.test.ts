import { app } from '@api/app'
import { db } from '@api/db/connection'
import { labels, taskLabels, timeBlocks } from '@api/db/schema'
import { createTask, TEST_UUID } from '@api/routes/tasks/testing'
import { passthroughSchema, setupTestDb } from '@api/testing'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import {
  type CallToolResult,
  CallToolResultSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { and, eq, isNull } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

setupTestDb()

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

function normalizeDynamicValues(value: unknown): unknown {
  if (typeof value === 'string') {
    if (UUID_PATTERN.test(value)) return '<uuid>'
    if (TIMESTAMP_PATTERN.test(value)) return '<timestamp>'
    return value
  }
  if (Array.isArray(value)) return value.map(normalizeDynamicValues)
  if (value != null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [key, normalizeDynamicValues(v)]),
    )
  }
  return value
}

// Raw parse, keeping real ids/timestamps as-is. Use this only to pull a
// value (e.g. a created task's id) needed to drive further calls in the
// test; use `parseToolData` when asserting on the result itself.
function parseToolJson(result: CallToolResult): unknown {
  const [first] = result.content
  if (first?.type !== 'text') throw new Error('expected text content')
  return JSON.parse(first.text)
}

function parseToolData(result: CallToolResult): unknown {
  return normalizeDynamicValues(parseToolJson(result))
}

let client: Client

beforeEach(async () => {
  client = new Client({ name: 'test-client', version: '1.0.0' })
  const transport = new StreamableHTTPClientTransport(
    new URL('http://localhost/api/mcp'),
    { fetch: async (url, init) => app.request(url, init) },
  )
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- see index.integration.test.ts
  await client.connect(transport as Transport)
})

afterEach(async () => {
  await client.close()
})

async function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const result = await client.callTool(
    { name, arguments: args },
    CallToolResultSchema,
  )
  // `callTool`'s return type is the same content/toolResult union regardless
  // of which `resultSchema` is passed, so passing `CallToolResultSchema`
  // guarantees the `content` shape at runtime without narrowing the type.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- see comment above
  return result as CallToolResult
}

describe('create_task tool', () => {
  it('creates a task with the given fields', async () => {
    const result = await callTool('create_task', {
      title: 'Write MCP tools',
      context: 'work',
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      title: 'Write MCP tools',
      description: null,
      status: 'todo',
      context: 'work',
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      sortOrder: 0,
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })
  })

  it('attaches only the labels that exist, ignoring unknown names', async () => {
    await db.insert(labels).values({ name: 'urgent' })

    const result = await callTool('create_task', {
      title: 'Labeled task',
      labels: ['urgent', 'unknown'],
    })

    const data = passthroughSchema<{ id: string }>().parse(
      parseToolJson(result),
    )
    const attached = await db
      .select({ name: labels.name })
      .from(taskLabels)
      .innerJoin(labels, eq(taskLabels.labelId, labels.id))
      .where(eq(taskLabels.taskId, data.id))

    expect(attached).toEqual([{ name: 'urgent' }])
  })

  it('rejects a non-existent parentId', async () => {
    const result = await callTool('create_task', {
      title: 'Orphan',
      parentId: TEST_UUID,
    })

    expect(result).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'Parent task not found' }],
    })
  })
})

describe('update_task tool', () => {
  it('partially updates the given fields', async () => {
    const task = await createTask('Original title', {
      description: 'Original description',
    })

    const result = await callTool('update_task', {
      taskId: task.id,
      title: 'Updated title',
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      title: 'Updated title',
      description: 'Original description',
      status: 'todo',
      context: 'personal',
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      sortOrder: 0,
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })
  })

  it('clears a nullable field by passing null', async () => {
    const task = await createTask('Has description', {
      description: 'Will be cleared',
    })

    const result = await callTool('update_task', {
      taskId: task.id,
      description: null,
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      title: 'Has description',
      description: null,
      status: 'todo',
      context: 'personal',
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      sortOrder: 0,
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })
  })

  it('rejects a non-existent taskId', async () => {
    const result = await callTool('update_task', {
      taskId: TEST_UUID,
      title: 'New title',
    })

    expect(result).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'Task not found' }],
    })
  })
})

describe('update_task_status tool', () => {
  it('starts a task, opening a TimeBlock', async () => {
    const task = await createTask('Start me')

    const result = await callTool('update_task_status', {
      taskId: task.id,
      status: 'in_progress',
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      title: 'Start me',
      description: null,
      status: 'in_progress',
      context: 'personal',
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      sortOrder: 0,
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
      timeBlock: {
        id: '<uuid>',
        taskId: '<uuid>',
        startTime: '<timestamp>',
        endTime: null,
        isAutoScheduled: false,
        createdAt: '<timestamp>',
        updatedAt: '<timestamp>',
      },
    })
  })

  it('stops a task, closing the open TimeBlock', async () => {
    const task = await createTask('Stop me')
    await callTool('update_task_status', {
      taskId: task.id,
      status: 'in_progress',
    })

    const result = await callTool('update_task_status', {
      taskId: task.id,
      status: 'todo',
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      title: 'Stop me',
      description: null,
      status: 'todo',
      context: 'personal',
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      sortOrder: 0,
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })

    const openTimeBlocks = await db
      .select()
      .from(timeBlocks)
      .where(and(eq(timeBlocks.taskId, task.id), isNull(timeBlocks.endTime)))
    expect(openTimeBlocks).toEqual([])
  })

  it('reopens a completed task by moving it back to todo', async () => {
    const task = await createTask('Reopen me')
    await callTool('update_task_status', {
      taskId: task.id,
      status: 'completed',
    })

    const result = await callTool('update_task_status', {
      taskId: task.id,
      status: 'todo',
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      title: 'Reopen me',
      description: null,
      status: 'todo',
      context: 'personal',
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      sortOrder: 0,
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })
  })

  it('completes a recurring task and generates its next occurrence', async () => {
    const created = await callTool('create_task', {
      title: 'Daily recurring task',
      dueDate: '2026-03-22',
      recurrenceRule: { type: 'daily', interval: 1 },
    })
    const createdData = passthroughSchema<{ id: string }>().parse(
      parseToolJson(created),
    )

    const result = await callTool('update_task_status', {
      taskId: createdData.id,
      status: 'completed',
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      title: 'Daily recurring task',
      description: null,
      status: 'completed',
      context: 'personal',
      startDate: null,
      dueDate: '2026-03-22',
      estimatedMinutes: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: '<uuid>',
      recurrenceRule: {
        id: '<uuid>',
        type: 'daily',
        interval: 1,
        daysOfWeek: null,
        dayOfMonth: null,
      },
      sortOrder: 0,
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
      closedTimeBlocks: [],
      nextTask: {
        id: '<uuid>',
        title: 'Daily recurring task',
        description: null,
        status: 'todo',
        context: 'personal',
        startDate: null,
        dueDate: '2026-03-23',
        estimatedMinutes: null,
        parentId: null,
        projectId: null,
        recurrenceRuleId: '<uuid>',
        recurrenceRule: {
          id: '<uuid>',
          type: 'daily',
          interval: 1,
          daysOfWeek: null,
          dayOfMonth: null,
        },
        sortOrder: 0,
        createdAt: '<timestamp>',
        updatedAt: '<timestamp>',
      },
    })
  })

  it('rejects starting a task that is already in progress', async () => {
    const task = await createTask('Already started')
    await callTool('update_task_status', {
      taskId: task.id,
      status: 'in_progress',
    })

    const result = await callTool('update_task_status', {
      taskId: task.id,
      status: 'in_progress',
    })

    expect(result).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'Task is already in progress' }],
    })
  })
})
