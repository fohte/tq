import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  callMcpTool,
  connectMcpClient,
  parseToolData,
} from '#routes/mcp/testing'
import { setupTestDb } from '#testing'

setupTestDb()

let client: Client

function memoToolOutput(
  empty: CallToolResult,
  created: CallToolResult,
  updated: CallToolResult,
  stale: CallToolResult,
  current: CallToolResult,
) {
  return {
    empty: parseToolData(empty),
    created: parseToolData(created),
    updated: parseToolData(updated),
    stale,
    current: parseToolData(current),
  }
}

beforeEach(async () => {
  client = await connectMcpClient()
})

afterEach(async () => {
  await client.close()
})

describe('memo MCP tools', () => {
  it('reads and updates a memo with revision conflict protection', async () => {
    const empty = await callMcpTool(client, 'memo_get', { context: 'work' })
    const created = await callMcpTool(client, 'memo_update', {
      context: 'work',
      content: 'Captured through MCP',
      revision: 0,
    })
    const updated = await callMcpTool(client, 'memo_update', {
      context: 'work',
      content: 'Revised through MCP',
      revision: 1,
    })
    const stale = await callMcpTool(client, 'memo_update', {
      context: 'work',
      content: 'Stale replacement',
      revision: 1,
    })
    const current = await callMcpTool(client, 'memo_get', { context: 'work' })

    expect(memoToolOutput(empty, created, updated, stale, current)).toEqual({
      empty: {
        context: 'work',
        content: '',
        revision: 0,
        updatedAt: null,
      },
      created: {
        context: 'work',
        content: 'Captured through MCP',
        revision: 1,
        updatedAt: '<timestamp>',
      },
      updated: {
        context: 'work',
        content: 'Revised through MCP',
        revision: 2,
        updatedAt: '<timestamp>',
      },
      stale: {
        isError: true,
        content: [
          {
            type: 'text',
            text: 'Memo has changed; fetch the latest revision before updating',
          },
        ],
      },
      current: {
        context: 'work',
        content: 'Revised through MCP',
        revision: 2,
        updatedAt: '<timestamp>',
      },
    })
  })
})
