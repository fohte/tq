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
  updated: CallToolResult,
  stale: CallToolResult,
  current: CallToolResult,
) {
  return {
    empty: parseToolData(empty),
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
    const updated = await callMcpTool(client, 'memo_update', {
      context: 'work',
      content: 'Captured through MCP',
      revision: 0,
    })
    const stale = await callMcpTool(client, 'memo_update', {
      context: 'work',
      content: 'Stale replacement',
      revision: 0,
    })
    const current = await callMcpTool(client, 'memo_get', { context: 'work' })

    expect(memoToolOutput(empty, updated, stale, current)).toEqual({
      empty: {
        context: 'work',
        content: '',
        revision: 0,
        updatedAt: null,
      },
      updated: {
        context: 'work',
        content: 'Captured through MCP',
        revision: 1,
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
        content: 'Captured through MCP',
        revision: 1,
        updatedAt: '<timestamp>',
      },
    })
  })
})
