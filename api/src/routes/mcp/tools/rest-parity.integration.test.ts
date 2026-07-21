import { app } from '@api/app'
import {
  callMcpTool,
  connectMcpClient,
  parseToolJson,
} from '@api/routes/mcp/testing'
import {
  createTask,
  type TaskResponse,
  type TimeBlockResponse,
} from '@api/routes/tasks/testing'
import {
  assertDefined,
  jsonBody,
  passthroughSchema,
  setupTestDb,
} from '@api/testing'
import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

setupTestDb()

// These tests confirm that data written through an MCP write tool is visible,
// in the same shape, through the plain REST routes the web UI reads from —
// not the MCP read tools (read-tools.integration.test.ts) and not the write
// tool's own response (write-tools.integration.test.ts).

type StartedTaskResponse = TaskResponse & { timeBlock: TimeBlockResponse }
type CompletedTaskResponse = TaskResponse & {
  closedTimeBlocks: TimeBlockResponse[]
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
      childCompletionCount: { total: 0, completed: 0 },
      pages: [],
      timeBlocks: [],
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
      { ...data, activeTimeBlockStartTime: null },
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
      childCompletionCount: { total: 0, completed: 0 },
      pages: [],
      timeBlocks: [],
    })
  })

  it('starting a task via update_task_status opens a TimeBlock visible through GET /api/tasks/:id', async () => {
    const task = await createTask('Start via MCP')

    const started = await callTool('update_task_status', {
      taskId: task.id,
      status: 'in_progress',
    })
    const { timeBlock, ...data } =
      passthroughSchema<StartedTaskResponse>().parse(parseToolJson(started))

    const res = await app.request(`/api/tasks/${task.id}`)
    expect(res.status).toBe(200)

    expect(await jsonBody(res)).toEqual({
      ...data,
      childCompletionCount: { total: 0, completed: 0 },
      pages: [],
      timeBlocks: [timeBlock],
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
        ...completedTask,
        recurrenceRule: null,
        activeTimeBlockStartTime: null,
      },
      { ...nextTask, recurrenceRule: null, activeTimeBlockStartTime: null },
    ]

    // GET /api/tasks (list) never hydrates recurrenceRule, unlike the detail
    // endpoint and this write tool's own response. Sorting both sides by id
    // avoids depending on the unspecified tie-break order Postgres uses when
    // sortOrder and createdAt are identical for both tasks.
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
      childCompletionCount: { total: 0, completed: 0 },
      pages: [],
      timeBlocks: [],
    })
  })
})
