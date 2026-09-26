import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it } from 'vitest'

import { app } from '#app'
import { createTask } from '#routes/tasks/testing'
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

describe('queue read tools', () => {
  describe('get_today_tasks', () => {
    it('rejects invalid input', async () => {
      const result = await callTool('get_today_tasks', { date: 'not-a-date' })

      expect(result.isError).toBe(true)
    })

    it('returns the queue for an explicit date', async () => {
      const task = await createTask('Queued task')
      const putRes = await app.request('/api/queues/day/items', {
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
      const putRes = await app.request('/api/queues/day/items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: [task.id], date: today }),
      })
      const queued = await jsonBody<Record<string, unknown>[]>(putRes)

      const toolResult = await callTool('get_today_tasks')

      expect(parseJson(toolResult)).toEqual(queued)
    })
  })
})
