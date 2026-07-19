import { app } from '@api/app'
import { createLabel, createTask, TEST_UUID } from '@api/routes/tasks/testing'
import { jsonBody, setupTestDb } from '@api/testing'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it } from 'vitest'

setupTestDb()

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
  it('declares every tool as read-only', async () => {
    const result = await withClient((client) => client.listTools())

    expect(
      result.tools
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

    it('matches the REST endpoint result', async () => {
      await createTask('Work task', { context: 'work' })
      await createTask('Personal task')

      const restRes = await app.request('/api/tasks?context=work')
      const restBody = await jsonBody<Record<string, unknown>[]>(restRes)

      const toolResult = await callTool('list_tasks', { context: 'work' })

      expect(parseJson(toolResult)).toEqual(restBody)
    })
  })

  describe('get_task', () => {
    it('rejects invalid input', async () => {
      const result = await callTool('get_task', { taskId: 'not-a-uuid' })

      expect(result.isError).toBe(true)
    })

    it('merges the task detail with its subtask tree', async () => {
      const parent = await createTask('Parent')
      await createTask('Child', { parentId: parent.id })

      const [restRes, treeRes] = await Promise.all([
        app.request(`/api/tasks/${parent.id}`),
        app.request(`/api/tasks/tree?rootId=${parent.id}`),
      ])
      const restBody = await jsonBody<Record<string, unknown>>(restRes)
      const treeBody = await jsonBody<Array<{ children: unknown }>>(treeRes)

      const toolResult = await callTool('get_task', { taskId: parent.id })

      expect(parseJson(toolResult)).toEqual({
        ...restBody,
        subtasks: treeBody[0]?.children ?? [],
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

    it('matches the REST endpoint result', async () => {
      await createTask('Deploy to production')
      await createTask('Buy groceries')

      const restRes = await app.request(
        '/api/tasks/search?q=' + encodeURIComponent('deploy'),
      )
      const restBody = await jsonBody<Record<string, unknown>[]>(restRes)

      const toolResult = await callTool('search_tasks', { q: 'deploy' })

      expect(parseJson(toolResult)).toEqual(restBody)
    })

    it('translates boolean hasEstimate/hasDue into the REST string params', async () => {
      await createTask('With estimate', { estimatedMinutes: 30 })
      await createTask('Without estimate')

      const restRes = await app.request('/api/tasks/search?hasEstimate=false')
      const restBody = await jsonBody<Record<string, unknown>[]>(restRes)

      const toolResult = await callTool('search_tasks', { hasEstimate: false })

      expect(parseJson(toolResult)).toEqual(restBody)
    })
  })

  describe('get_today_tasks', () => {
    it('rejects invalid input', async () => {
      const result = await callTool('get_today_tasks', { date: 'not-a-date' })

      expect(result.isError).toBe(true)
    })

    it('matches the REST endpoint result for an explicit date', async () => {
      const task = await createTask('Queued task')
      await app.request('/api/schedule/today-tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: [task.id], date: '2026-01-15' }),
      })

      const restRes = await app.request(
        '/api/schedule/today-tasks?date=2026-01-15',
      )
      const restBody = await jsonBody<Record<string, unknown>[]>(restRes)

      const toolResult = await callTool('get_today_tasks', {
        date: '2026-01-15',
      })

      expect(parseJson(toolResult)).toEqual(restBody)
    })

    it('defaults to the current UTC date when date is omitted', async () => {
      const today = new Date().toISOString().slice(0, 10)
      const task = await createTask('Queued task')
      await app.request('/api/schedule/today-tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: [task.id], date: today }),
      })

      const restRes = await app.request(
        `/api/schedule/today-tasks?date=${today}`,
      )
      const restBody = await jsonBody<Record<string, unknown>[]>(restRes)

      const toolResult = await callTool('get_today_tasks')

      expect(parseJson(toolResult)).toEqual(restBody)
    })
  })

  describe('list_projects', () => {
    it('rejects invalid input', async () => {
      const result = await callTool('list_projects', { status: 'bogus' })

      expect(result.isError).toBe(true)
    })

    it('matches the REST endpoint result', async () => {
      await app.request('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Website redesign' }),
      })

      const restRes = await app.request('/api/projects')
      const restBody = await jsonBody<Record<string, unknown>[]>(restRes)

      const toolResult = await callTool('list_projects')

      expect(parseJson(toolResult)).toEqual(restBody)
    })
  })

  describe('list_labels', () => {
    it('matches the REST endpoint result', async () => {
      await createLabel('urgent')

      const restRes = await app.request('/api/labels')
      const restBody = await jsonBody<Record<string, unknown>[]>(restRes)

      const toolResult = await callTool('list_labels')

      expect(parseJson(toolResult)).toEqual(restBody)
    })
  })
})
