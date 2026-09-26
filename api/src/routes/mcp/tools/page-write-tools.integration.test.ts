import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import {
  type CallToolResult,
  CallToolResultSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { app } from '#app'
import { createPage, createTask, TEST_UUID } from '#routes/tasks/testing'
import { setupTestDb } from '#testing'

setupTestDb()

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

// `number` is a per-suite-run sequential value (the sequence isn't rolled
// back with the surrounding test transaction), so it's normalized like the
// uuid/timestamp fields rather than asserted on directly. `skipKeys` opts a
// key out of uuid/timestamp normalization for callers that already know its
// real value (e.g. a page/comment response's `taskId`, or an updated
// resource's own `id`) and want to assert on that value directly instead of
// blurring it into a placeholder.
function normalizeDynamicValues(
  value: unknown,
  key: string | undefined,
  skipKeys: ReadonlySet<string>,
): unknown {
  if (key != null && skipKeys.has(key)) return value
  if (key === 'number' && typeof value === 'number') return '<number>'
  if (typeof value === 'string') {
    if (UUID_PATTERN.test(value)) return '<uuid>'
    if (TIMESTAMP_PATTERN.test(value)) return '<timestamp>'
    return value
  }
  if (Array.isArray(value)) {
    return value.map((v) => normalizeDynamicValues(v, undefined, skipKeys))
  }
  if (value != null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        normalizeDynamicValues(v, k, skipKeys),
      ]),
    )
  }
  return value
}

function parseToolJson(result: CallToolResult): unknown {
  const [first] = result.content
  if (first?.type !== 'text') throw new Error('expected text content')
  return JSON.parse(first.text)
}

function parseToolData(
  result: CallToolResult,
  skipKeys: readonly string[] = [],
): unknown {
  return normalizeDynamicValues(
    parseToolJson(result),
    undefined,
    new Set(skipKeys),
  )
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

describe('page write tools', () => {
  describe('create_page tool', () => {
    it('creates a page with the given fields, attributed to the default mcp agent', async () => {
      const task = await createTask('Has pages')

      const result = await callTool('create_page', {
        taskId: task.id,
        title: 'My Page',
        content: 'Hello',
      })

      expect(parseToolData(result, ['taskId'])).toEqual({
        id: '<uuid>',
        taskId: task.id,
        title: 'My Page',
        content: 'Hello',
        format: 'markdown',
        sortOrder: 0,
        createdAt: '<timestamp>',
        updatedAt: '<timestamp>',
        author: { kind: 'llm', agent: 'mcp' },
        linkSync: { outgoing: [], unresolvedRefs: [] },
      })
    })

    it('attributes the page to an explicitly passed agent', async () => {
      const task = await createTask('Has pages')

      const result = await callTool('create_page', {
        taskId: task.id,
        title: 'My Page',
        agent: 'test-agent',
      })

      expect(parseToolData(result, ['taskId'])).toEqual({
        id: '<uuid>',
        taskId: task.id,
        title: 'My Page',
        content: '',
        format: 'markdown',
        sortOrder: 0,
        createdAt: '<timestamp>',
        updatedAt: '<timestamp>',
        author: { kind: 'llm', agent: 'test-agent' },
        linkSync: { outgoing: [], unresolvedRefs: [] },
      })
    })

    it('creates a page with format html', async () => {
      const task = await createTask('Has pages')

      const result = await callTool('create_page', {
        taskId: task.id,
        title: 'HTML Page',
        content: '<p>Hello</p>',
        format: 'html',
      })

      expect(parseToolData(result, ['taskId'])).toEqual({
        id: '<uuid>',
        taskId: task.id,
        title: 'HTML Page',
        content: '<p>Hello</p>',
        format: 'html',
        sortOrder: 0,
        createdAt: '<timestamp>',
        updatedAt: '<timestamp>',
        author: { kind: 'llm', agent: 'mcp' },
        linkSync: { outgoing: [], unresolvedRefs: [] },
      })
    })

    it('rejects a non-existent taskId', async () => {
      const result = await callTool('create_page', {
        taskId: TEST_UUID,
        title: 'Orphan page',
      })

      expect(result).toEqual({
        isError: true,
        content: [{ type: 'text', text: 'Task not found' }],
      })
    })
  })

  describe('update_page tool', () => {
    it('partially updates the given fields', async () => {
      const task = await createTask('Has pages')
      const page = await createPage(
        task.id,
        'Original title',
        'Original content',
      )

      const result = await callTool('update_page', {
        taskId: task.id,
        pageId: page.id,
        title: 'Updated title',
      })

      expect(parseToolData(result, ['id', 'taskId'])).toEqual({
        id: page.id,
        taskId: task.id,
        title: 'Updated title',
        content: 'Original content',
        format: 'markdown',
        sortOrder: 0,
        createdAt: '<timestamp>',
        updatedAt: '<timestamp>',
        author: { kind: 'llm', agent: 'mcp' },
      })
    })

    it('attributes the update to an explicitly passed agent', async () => {
      const task = await createTask('Has pages')
      const page = await createPage(
        task.id,
        'Original title',
        'Original content',
      )

      const result = await callTool('update_page', {
        taskId: task.id,
        pageId: page.id,
        content: 'Updated content',
        agent: 'test-agent',
      })

      expect(parseToolData(result, ['id', 'taskId'])).toEqual({
        id: page.id,
        taskId: task.id,
        title: 'Original title',
        content: 'Updated content',
        format: 'markdown',
        sortOrder: 0,
        createdAt: '<timestamp>',
        updatedAt: '<timestamp>',
        author: { kind: 'llm', agent: 'test-agent' },
        linkSync: { outgoing: [], unresolvedRefs: [] },
      })
    })

    it('updates format from markdown to html', async () => {
      const task = await createTask('Has pages')
      const page = await createPage(
        task.id,
        'Original title',
        'Original content',
      )

      const result = await callTool('update_page', {
        taskId: task.id,
        pageId: page.id,
        format: 'html',
      })

      // `author` reflects the page's last recorded edit, not this call: a
      // format-only change isn't tracked by `diffFields` (title/content only),
      // so no new edit is recorded and the author stays whoever created the
      // page — the `createPage` helper's default `human` author, not the mcp
      // tool's own `llm:mcp`.
      expect(parseToolData(result, ['id', 'taskId'])).toEqual({
        id: page.id,
        taskId: task.id,
        title: 'Original title',
        content: 'Original content',
        format: 'html',
        sortOrder: 0,
        createdAt: '<timestamp>',
        updatedAt: '<timestamp>',
        author: { kind: 'human', agent: null },
      })
    })

    it('rejects a non-existent pageId', async () => {
      const task = await createTask('Has pages')

      const result = await callTool('update_page', {
        taskId: task.id,
        pageId: TEST_UUID,
        title: 'Updated title',
      })

      expect(result).toEqual({
        isError: true,
        content: [{ type: 'text', text: 'Page not found' }],
      })
    })
  })
})
