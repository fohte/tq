import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import {
  type CallToolResult,
  CallToolResultSchema,
  type TextContent,
} from '@modelcontextprotocol/sdk/types.js'
import { expect } from 'vitest'

import { app } from '#app'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

interface NormalizeDynamicValuesOptions {
  taskNumbers?: boolean
  skipKeys?: readonly string[]
  numberPlaceholder?: boolean
}

export function normalizeDynamicValues(
  value: unknown,
  options: NormalizeDynamicValuesOptions = {},
): unknown {
  const normalize = (current: unknown, key?: string): unknown => {
    const { skipKeys } = options
    if (key != null && skipKeys?.includes(key) === true) return current
    if (key === 'number' && typeof current === 'number') {
      if (options.numberPlaceholder === true) return '<number>'
      if (options.taskNumbers === true) return -1
    }
    if (typeof current === 'string') {
      if (UUID_PATTERN.test(current)) return '<uuid>'
      if (TIMESTAMP_PATTERN.test(current)) return '<timestamp>'
      return current
    }
    if (Array.isArray(current)) {
      return current.map((item) => normalize(item))
    }
    if (current != null && typeof current === 'object') {
      return Object.fromEntries(
        Object.entries(current).map(([nestedKey, nested]) => [
          nestedKey,
          normalize(nested, nestedKey),
        ]),
      )
    }
    return current
  }

  return normalize(value)
}

function assertTextContent(
  first: CallToolResult['content'][number] | undefined,
): asserts first is TextContent {
  expect(first?.type, 'expected text content').toBe('text')
}

// Raw parse, keeping real ids/timestamps as-is. Use this only to pull a
// value (e.g. a created task's id) needed to drive further calls in the
// test; use `parseToolData` when asserting on the result itself.
export function parseToolJson(result: CallToolResult): unknown {
  const [first] = result.content
  assertTextContent(first)
  return JSON.parse(first.text)
}

export async function connectMcpClient(): Promise<Client> {
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
  return client
}

export async function callMcpTool(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
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

function normalizeToolData(
  value: unknown,
  skipKeys: readonly string[] = [],
): unknown {
  return normalizeDynamicValues(value, {
    skipKeys,
    numberPlaceholder: true,
  })
}

export function parseToolData(
  result: CallToolResult,
  skipKeys: readonly string[] = [],
): unknown {
  return normalizeToolData(parseToolJson(result), skipKeys)
}
