import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { app } from '#app'
import { jsonBody, setupTestDb } from '#testing'

// Per-tool schema/description/annotation detail is covered by each tool
// group's own tests; both protocol-era tests below only pin down that every
// registered tool is reachable through the wire protocol.
const REGISTERED_TOOL_NAMES = [
  'create_comment',
  'create_page',
  'create_task',
  'get_page',
  'get_task',
  'get_today_tasks',
  'list_labels',
  'list_projects',
  'list_tasks',
  'search_tasks',
  'update_comment',
  'update_page',
  'update_task',
  'update_task_status',
]

// `mcpApp` is mounted with `.route()` on the same `app` instance as every
// other route (see api/src/app.ts) instead of a dedicated server or
// middleware stack, so it runs through the existing OTel HTTP
// auto-instrumentation exactly like any other route.
describe('MCP endpoint', () => {
  it('completes initialize and lists the registered tools', async () => {
    const client = new Client({ name: 'test-client', version: '1.0.0' })
    const transport = new StreamableHTTPClientTransport(
      new URL('http://localhost/api/mcp'),
      {
        fetch: async (url, init) => app.request(url, init),
      },
    )
    // `Transport.sessionId` is `sessionId?: string`, which `exactOptionalPropertyTypes`
    // treats as excluding `undefined`; this class's getter returns `string | undefined`,
    // so the SDK's own types don't satisfy its interface under this tsconfig.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- see comment above
    await client.connect(transport as Transport)

    try {
      const result = await client.listTools()

      expect(result.tools.map((tool) => tool.name).sort()).toEqual(
        REGISTERED_TOOL_NAMES,
      )
    } finally {
      await client.close()
    }
  })
})

// A 2026-07-28 client (e.g. the Cloudflare MCP portal) carries no
// `initialize`/`Mcp-Session-Id` handshake: every request is fully
// self-contained, naming the protocol version in both a header and the
// JSON-RPC `params._meta` envelope. These requests build that shape by hand
// (no client SDK is speaking it here) to exercise that path directly.
describe('MCP endpoint (2026-07-28 protocol)', () => {
  setupTestDb()

  function modernRequestInit(
    method: string,
    params: Record<string, unknown>,
    id: number,
  ): RequestInit {
    return {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'MCP-Protocol-Version': '2026-07-28',
        'Mcp-Method': method,
        ...(typeof params['name'] === 'string'
          ? { 'Mcp-Name': params['name'] }
          : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params: {
          ...params,
          _meta: {
            'io.modelcontextprotocol/protocolVersion': '2026-07-28',
            'io.modelcontextprotocol/clientCapabilities': {},
          },
        },
      }),
    }
  }

  it('lists the registered tools', async () => {
    const res = await app.request(
      'http://localhost/api/mcp',
      modernRequestInit('tools/list', {}, 1),
    )

    expect(res.status).toBe(200)
    const body = await jsonBody(
      res,
      z.object({
        result: z.object({ tools: z.array(z.object({ name: z.string() })) }),
      }),
    )
    expect(body.result.tools.map((tool) => tool.name).sort()).toEqual(
      REGISTERED_TOOL_NAMES,
    )
  })

  it("returns a tool's result without an initialize handshake", async () => {
    const res = await app.request(
      'http://localhost/api/mcp',
      modernRequestInit(
        'tools/call',
        { name: 'list_labels', arguments: {} },
        2,
      ),
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      jsonrpc: '2.0',
      id: 2,
      result: {
        content: [{ type: 'text', text: '[]' }],
        resultType: 'complete',
        _meta: {
          'io.modelcontextprotocol/serverInfo': {
            name: 'tq',
            version: '0.1.0',
          },
        },
      },
    })
  })
})
