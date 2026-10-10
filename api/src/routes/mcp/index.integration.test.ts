import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { app } from '#app'
import { jsonBody, setupTestDb } from '#testing'

// Tool-specific schema and annotation details live with their operation or
// write-tool integration tests; these tests pin down wire-level reachability.
const REGISTERED_TOOL_NAMES = [
  'asset_delete',
  'calendar_events',
  'checklist_create',
  'checklist_delete',
  'checklist_item_add',
  'checklist_item_check',
  'checklist_item_delete',
  'checklist_item_move',
  'checklist_item_promote',
  'checklist_item_uncheck',
  'checklist_item_update',
  'checklist_list',
  'checklist_update',
  'comment_create',
  'comment_delete',
  'comment_list',
  'comment_update',
  'description_template_get',
  'description_template_list',
  'github_link',
  'github_notify',
  'github_resolve',
  'github_sync',
  'github_unlink',
  'health',
  'label_delete',
  'label_list',
  'label_update',
  'memo_get',
  'memo_update',
  'page_create',
  'page_delete',
  'page_get',
  'page_list',
  'page_search',
  'page_update',
  'project_create',
  'project_delete',
  'project_get',
  'project_list',
  'project_tasks',
  'project_update',
  'queue_get',
  'queue_list',
  'queue_set',
  'saved_view_create',
  'saved_view_delete',
  'saved_view_get',
  'saved_view_list',
  'saved_view_update',
  'schedule_events_list',
  'schedule_override_clear',
  'schedule_override_set',
  'schedule_time_blocks_create',
  'schedule_time_blocks_delete',
  'schedule_time_blocks_list',
  'schedule_time_blocks_update',
  'session_archive',
  'session_delete',
  'session_list',
  'task_activity',
  'task_complete',
  'task_create',
  'task_delete',
  'task_from_github',
  'task_get',
  'task_list',
  'task_parent',
  'task_search',
  'task_sessions',
  'task_status',
  'task_update',
  'wait_acknowledge',
  'wait_add',
  'wait_remove',
  'wait_resolve',
  'wait_update',
]

function summarizeTools(
  tools: Awaited<ReturnType<Client['listTools']>>['tools'],
) {
  return tools.map((tool) => tool.name).sort()
}

// The MCP handler is mounted on the same `app` instance as every other route
// (see api/src/app.ts), so it runs through the existing OTel HTTP
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

      expect(summarizeTools(result.tools)).toEqual(REGISTERED_TOOL_NAMES)
    } finally {
      await client.close()
    }
  }, 10_000)
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
      modernRequestInit('tools/call', { name: 'label_list', arguments: {} }, 2),
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
