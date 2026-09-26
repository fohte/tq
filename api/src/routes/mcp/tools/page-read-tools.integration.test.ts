import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it } from 'vitest'

import { app } from '#app'
import { normalizeDynamicValues } from '#routes/mcp/testing'
import {
  createComment,
  createPage,
  createTask,
  TEST_UUID,
} from '#routes/tasks/testing'
import { setupTestDb } from '#testing'

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

describe('page read tools', () => {
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

  describe('search_pages', () => {
    it('rejects invalid input', async () => {
      const result = await callTool('search_pages', { q: '   ' })

      expect(result.isError).toBe(true)
    })

    it('returns page matches with location metadata', async () => {
      const task = await createTask('Task with searchable history')
      await createPage(task.id, 'Investigation log', 'mcp page locator')

      const toolResult = await callTool('search_pages', {
        q: 'mcp page locator',
        limit: 1,
      })

      expect(normalizeDynamicValues(parseJson(toolResult))).toEqual({
        results: [
          {
            source: 'page',
            taskNumber: task.number,
            taskTitle: 'Task with searchable history',
            pageId: '<uuid>',
            pageTitle: 'Investigation log',
            snippet: 'mcp page locator',
            matchCount: 3,
            updatedAt: '<timestamp>',
          },
        ],
      })
    })

    it('returns comment matches without page metadata', async () => {
      const task = await createTask('Task with searchable history')
      await createComment(task.id, 'mcp comment locator')

      const toolResult = await callTool('search_pages', {
        q: 'mcp comment locator',
      })

      expect(normalizeDynamicValues(parseJson(toolResult))).toEqual({
        results: [
          {
            source: 'comment',
            taskNumber: task.number,
            taskTitle: 'Task with searchable history',
            pageId: null,
            pageTitle: null,
            snippet: 'mcp comment locator',
            matchCount: 3,
            updatedAt: '<timestamp>',
          },
        ],
      })
    })
  })
})
