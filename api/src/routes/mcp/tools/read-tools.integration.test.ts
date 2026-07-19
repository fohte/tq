import { app } from '@api/app'
import { createLabel, createTask, TEST_UUID } from '@api/routes/tasks/testing'
import { jsonBody, setupTestDb } from '@api/testing'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it } from 'vitest'

setupTestDb()

const READ_TOOL_NAMES = [
  'get_task',
  'get_today_tasks',
  'list_labels',
  'list_projects',
  'list_tasks',
  'search_tasks',
]

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ name: 'test-client', version: '1.0.0' })
  const transport = new StreamableHTTPClientTransport(
    new URL('http://localhost/api/mcp'),
    { fetch: async (url, init) => app.request(url, init) },
  )
  // `Transport.sessionId` is `sessionId?: string`, which `exactOptionalPropertyTypes`
  // treats as excluding `undefined`; this class's getter returns `string | undefined`,
  // so the SDK's own types don't satisfy its interface under this tsconfig.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- see comment above
  await client.connect(transport as Transport)

  try {
    return await fn(client)
  } finally {
    await client.close()
  }
}

async function callTool(
  name: string,
  args: Record<string, unknown> = {},
): Promise<CallToolResult> {
  const result = await withClient((client) =>
    client.callTool({ name, arguments: args }),
  )
  // The SDK's `Client.callTool` return type is derived from a Zod schema and
  // doesn't narrow `content` the way the standalone `CallToolResult` type
  // (used by `route-bridge.ts`) does; the two describe the same wire shape.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- see comment above
  return result as CallToolResult
}

function parseJson(result: CallToolResult): unknown {
  const first = result.content[0]
  if (first?.type !== 'text') {
    throw new Error(
      `Expected a single text content item, got: ${JSON.stringify(result.content)}`,
    )
  }
  return JSON.parse(first.text)
}

describe('read tools', () => {
  it('declares every read tool as read-only', async () => {
    const result = await withClient((client) => client.listTools())

    expect(
      result.tools
        .filter((tool) => READ_TOOL_NAMES.includes(tool.name))
        .map((tool) => ({
          name: tool.name,
          readOnlyHint: tool.annotations?.readOnlyHint,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    ).toEqual([
      { name: 'get_task', readOnlyHint: true },
      { name: 'get_today_tasks', readOnlyHint: true },
      { name: 'list_labels', readOnlyHint: true },
      { name: 'list_projects', readOnlyHint: true },
      { name: 'list_tasks', readOnlyHint: true },
      { name: 'search_tasks', readOnlyHint: true },
    ])
  })

  describe('list_tasks', () => {
    it('rejects invalid input', async () => {
      const result = await callTool('list_tasks', { projectId: 'not-a-uuid' })

      expect(result.isError).toBe(true)
    })

    it('returns tasks matching the given filters', async () => {
      const task = await createTask('Work task', { context: 'work' })
      await createTask('Personal task')

      const toolResult = await callTool('list_tasks', { context: 'work' })

      expect(parseJson(toolResult)).toEqual([
        { ...task, activeTimeBlockStartTime: null },
      ])
    })
  })

  describe('get_task', () => {
    it('rejects invalid input', async () => {
      const result = await callTool('get_task', { taskId: 'not-a-uuid' })

      expect(result.isError).toBe(true)
    })

    it('merges the task detail with its subtask tree', async () => {
      const parent = await createTask('Parent')
      const child = await createTask('Child', { parentId: parent.id })

      const toolResult = await callTool('get_task', { taskId: parent.id })

      expect(parseJson(toolResult)).toEqual({
        ...parent,
        childCompletionCount: { total: 1, completed: 0 },
        pages: [],
        timeBlocks: [],
        subtasks: [
          {
            ...child,
            activeTimeBlockStartTime: null,
            children: [],
            childCompletionCount: { total: 0, completed: 0 },
          },
        ],
      })
    })

    it('maps a non-existent task id to a 404 error result', async () => {
      const result = await callTool('get_task', { taskId: TEST_UUID })

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Task not found' }],
        isError: true,
      })
    })
  })

  describe('search_tasks', () => {
    it('rejects invalid input', async () => {
      const result = await callTool('search_tasks', { limit: 0 })

      expect(result.isError).toBe(true)
    })

    it('returns tasks matching the free-text query', async () => {
      const match = await createTask('Deploy to production')
      await createTask('Buy groceries')

      const toolResult = await callTool('search_tasks', { q: 'deploy' })

      expect(parseJson(toolResult)).toEqual([match])
    })

    it('translates hasEstimate into the REST string param', async () => {
      await createTask('With estimate', { estimatedMinutes: 30 })
      const withoutEstimate = await createTask('Without estimate')

      const toolResult = await callTool('search_tasks', { hasEstimate: false })

      expect(parseJson(toolResult)).toEqual([withoutEstimate])
    })

    it('translates hasDue into the REST string param', async () => {
      const withDue = await createTask('With due date', {
        dueDate: '2026-02-01',
      })
      await createTask('Without due date')

      const toolResult = await callTool('search_tasks', { hasDue: true })

      expect(parseJson(toolResult)).toEqual([withDue])
    })
  })

  describe('get_today_tasks', () => {
    it('rejects invalid input', async () => {
      const result = await callTool('get_today_tasks', { date: 'not-a-date' })

      expect(result.isError).toBe(true)
    })

    it('returns the queue for an explicit date', async () => {
      const task = await createTask('Queued task')
      const putRes = await app.request('/api/schedule/today-tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: [task.id], date: '2026-01-15' }),
      })
      const queued = await jsonBody<Record<string, unknown>[]>(putRes)

      const toolResult = await callTool('get_today_tasks', {
        date: '2026-01-15',
      })

      expect(parseJson(toolResult)).toEqual(queued)
    })

    // `today` and the tool's own internal `new Date()` call are evaluated a
    // few milliseconds apart, so this could in principle flake right at a
    // UTC midnight boundary; accepted as negligible.
    it('defaults to the current UTC date when date is omitted', async () => {
      const today = new Date().toISOString().slice(0, 10)
      const task = await createTask('Queued task')
      const putRes = await app.request('/api/schedule/today-tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: [task.id], date: today }),
      })
      const queued = await jsonBody<Record<string, unknown>[]>(putRes)

      const toolResult = await callTool('get_today_tasks')

      expect(parseJson(toolResult)).toEqual(queued)
    })
  })

  describe('list_projects', () => {
    it('rejects invalid input', async () => {
      const result = await callTool('list_projects', { status: 'bogus' })

      expect(result.isError).toBe(true)
    })

    it('returns projects matching the given filter', async () => {
      const postRes = await app.request('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Website redesign' }),
      })
      const project = await jsonBody<Record<string, unknown>>(postRes)

      const toolResult = await callTool('list_projects')

      expect(parseJson(toolResult)).toEqual([project])
    })
  })

  describe('list_labels', () => {
    it('returns all labels', async () => {
      const label = await createLabel('urgent')

      const toolResult = await callTool('list_labels')

      expect(parseJson(toolResult)).toEqual([
        {
          id: label.id,
          name: 'urgent',
          color: label.color,
          createdAt: label.createdAt.toISOString(),
        },
      ])
    })
  })
})
