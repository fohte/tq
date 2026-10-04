import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { app } from '#app'
import {
  callMcpTool,
  connectMcpClient,
  normalizeDynamicValues,
  parseToolJson,
} from '#routes/mcp/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

let client: Client

beforeEach(async () => {
  client = await connectMcpClient()
})

afterEach(async () => {
  await client.close()
})

async function createAgentSession(): Promise<void> {
  const response = await app.request('/api/agent-sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'codex',
      sessionId: 'session-example',
      cwd: '/tmp/example',
      label: 'Example session',
      lastMessage: 'A long message',
    }),
  })
  await jsonBody(response, z.object({ id: z.uuid() }))
}

describe('session_list', () => {
  it('omits session last messages by default', async () => {
    await createAgentSession()
    const result = await callMcpTool(client, 'session_list', {
      sessionId: ['session-example'],
    })

    expect(normalizeDynamicValues(parseToolJson(result))).toEqual([
      {
        id: '<uuid>',
        provider: 'codex',
        sessionId: 'session-example',
        parentSessionId: null,
        context: 'personal',
        cwd: '/tmp/example',
        label: 'Example session',
        customLabel: null,
        startedAt: '<timestamp>',
        lastActiveAt: '<timestamp>',
        endedAt: null,
        archivedAt: null,
        tasks: [],
      },
    ])
  })

  it('includes session last messages when full is requested', async () => {
    await createAgentSession()
    const result = await callMcpTool(client, 'session_list', {
      sessionId: ['session-example'],
      full: true,
    })

    expect(normalizeDynamicValues(parseToolJson(result))).toEqual([
      {
        id: '<uuid>',
        provider: 'codex',
        sessionId: 'session-example',
        parentSessionId: null,
        context: 'personal',
        cwd: '/tmp/example',
        label: 'Example session',
        lastMessage: 'A long message',
        customLabel: null,
        startedAt: '<timestamp>',
        lastActiveAt: '<timestamp>',
        endedAt: null,
        archivedAt: null,
        tasks: [],
      },
    ])
  })
})
