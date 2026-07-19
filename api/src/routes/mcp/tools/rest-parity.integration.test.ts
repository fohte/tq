import { app } from '@api/app'
import {
  createTask,
  type TaskResponse,
  type TimeBlockResponse,
} from '@api/routes/tasks/testing'
import { jsonBody, passthroughSchema, setupTestDb } from '@api/testing'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import {
  type CallToolResult,
  CallToolResultSchema,
} from '@modelcontextprotocol/sdk/types.js'
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

function parseToolJson(result: CallToolResult): unknown {
  const [first] = result.content
  if (first?.type !== 'text') throw new Error('expected text content')
  return JSON.parse(first.text)
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

  it('a task created via create_task is visible through GET /api/tasks', async () => {
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

    expect(await jsonBody(res)).toEqual({
      ...data,
      childCompletionCount: { total: 0, completed: 0 },
      pages: [],
      timeBlocks: [timeBlock],
    })
  })

  it('completing a recurring task via update_task_status generates a next occurrence visible through GET /api/tasks and GET /api/tasks/:id', async () => {
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
    const { closedTimeBlocks, nextTask, ...completedTask } =
      passthroughSchema<CompletedTaskResponse>().parse(parseToolJson(completed))
    expect(closedTimeBlocks).toEqual([])
    if (nextTask == null)
      throw new Error('expected a next task to be generated')

    const listRes = await app.request('/api/tasks?context=personal')

    // GET /api/tasks (list) never hydrates recurrenceRule, unlike the detail
    // endpoint and this write tool's own response.
    expect(await jsonBody<unknown[]>(listRes)).toEqual([
      {
        ...completedTask,
        recurrenceRule: null,
        activeTimeBlockStartTime: null,
      },
      { ...nextTask, recurrenceRule: null, activeTimeBlockStartTime: null },
    ])

    const nextRes = await app.request(`/api/tasks/${nextTask.id}`)

    expect(await jsonBody(nextRes)).toEqual({
      ...nextTask,
      childCompletionCount: { total: 0, completed: 0 },
      pages: [],
      timeBlocks: [],
    })
  })
})
