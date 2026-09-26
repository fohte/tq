import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it } from 'vitest'

import { app } from '#app'
import {
  createPage,
  createTask,
  TEST_UUID,
  withoutLinkSync,
} from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

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

describe('task read tools', () => {
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

      const toolResult = await callTool('list_tasks', { parentId: 'root' })

      expect(parseJson(toolResult)).toEqual([
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
      const result = await callTool('get_task', { taskId: 'not-a-uuid' })

      expect(result.isError).toBe(true)
    })

    it('merges the task detail with its subtask tree', async () => {
      const parent = await createTask('Parent')
      const child = await createTask('Child', { parentId: parent.id })

      const toolResult = await callTool('get_task', { taskId: parent.id })

      expect(parseJson(toolResult)).toEqual({
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
      const result = await callTool('search_tasks', { limit: 0 })

      expect(result.isError).toBe(true)
    })

    it('returns tasks matching the free-text query', async () => {
      const match = await createTask('Deploy to production')
      await createTask('Buy groceries')

      const toolResult = await callTool('search_tasks', { q: 'deploy' })

      expect(parseJson(toolResult)).toEqual([
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

      const toolResult = await callTool('search_tasks', { hasEstimate: false })

      expect(parseJson(toolResult)).toEqual([
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

      const toolResult = await callTool('search_tasks', { hasDue: true })

      expect(parseJson(toolResult)).toEqual([
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
})
