import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it } from 'vitest'

import { app } from '#app'
import {
  createLabel,
  createPage,
  createTask,
  TEST_UUID,
  withoutRecurrenceRule,
} from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

const READ_TOOL_NAMES = [
  'get_page',
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

// Placeholders out ids/timestamps so a test can assert a full known literal
// (title, content, author, ...) with `toEqual` instead of re-deriving the
// expected value from the same route under test.
function normalizeDynamicValues(value: unknown): unknown {
  if (typeof value === 'string') {
    if (UUID_PATTERN.test(value)) return '<uuid>'
    if (TIMESTAMP_PATTERN.test(value)) return '<timestamp>'
    return value
  }
  if (Array.isArray(value)) return value.map((v) => normalizeDynamicValues(v))
  if (value != null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, normalizeDynamicValues(v)]),
    )
  }
  return value
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
      { name: 'get_page', readOnlyHint: true },
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
        {
          ...withoutRecurrenceRule(task),
          parentNumber: null,
          labels: [],
          childCompletionCount: { total: 0, completed: 0 },
        },
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
        titleAuthor: { kind: 'human', agent: null },
        descriptionAuthor: { kind: 'human', agent: null },
        childCompletionCount: { total: 1, completed: 0 },
        pages: [],
        timeBlocks: [],
        links: { outgoing: [], incoming: [] },
        labels: [],
        subtasks: [
          {
            ...withoutRecurrenceRule(child),
            parentNumber: parent.number,
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

      const toolResult = await callTool('get_task', { taskId: task.id })

      expect(parseJson(toolResult)).toEqual({
        ...task,
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
        subtasks: [],
      })
    })
  })

  describe('get_page', () => {
    it('rejects invalid input', async () => {
      const result = await callTool('get_page', {
        taskId: 'not-a-uuid',
        pageId: TEST_UUID,
      })

      expect(result.isError).toBe(true)
    })

    it('returns the full page including content', async () => {
      const task = await createTask('Task with notes')
      const created = await createPage(
        task.id,
        'Investigation notes',
        '# Findings\n\nSome long content.',
      )

      const toolResult = await callTool('get_page', {
        taskId: task.id,
        pageId: created.id,
      })

      expect(normalizeDynamicValues(parseJson(toolResult))).toEqual({
        id: '<uuid>',
        taskId: '<uuid>',
        title: 'Investigation notes',
        content: '# Findings\n\nSome long content.',
        format: 'markdown',
        sortOrder: 0,
        createdAt: '<timestamp>',
        updatedAt: '<timestamp>',
        author: { kind: 'human', agent: null },
      })
    })

    it('maps a non-existent page id to a 404 error result', async () => {
      const task = await createTask('Task')

      const result = await callTool('get_page', {
        taskId: task.id,
        pageId: TEST_UUID,
      })

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Page not found' }],
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

      expect(parseJson(toolResult)).toEqual([
        {
          ...withoutRecurrenceRule(match),
          parentNumber: null,
          childCompletionCount: { total: 0, completed: 0 },
        },
      ])
    })

    it('translates hasEstimate into the REST string param', async () => {
      await createTask('With estimate', { estimatedMinutes: 30 })
      const withoutEstimate = await createTask('Without estimate')

      const toolResult = await callTool('search_tasks', { hasEstimate: false })

      expect(parseJson(toolResult)).toEqual([
        {
          ...withoutRecurrenceRule(withoutEstimate),
          parentNumber: null,
          childCompletionCount: { total: 0, completed: 0 },
        },
      ])
    })

    it('translates hasDue into the REST string param', async () => {
      const withDue = await createTask('With due date', {
        dueDate: '2026-02-01',
      })
      await createTask('Without due date')

      const toolResult = await callTool('search_tasks', { hasDue: true })

      expect(parseJson(toolResult)).toEqual([
        {
          ...withoutRecurrenceRule(withDue),
          parentNumber: null,
          childCompletionCount: { total: 0, completed: 0 },
        },
      ])
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

      expect(parseJson(toolResult)).toEqual([
        {
          ...project,
          completionRate: 0,
          taskCount: { total: 0, completed: 0 },
        },
      ])
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
