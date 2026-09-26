import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { app } from '#app'
import {
  callMcpTool,
  connectMcpClient,
  parseToolJson,
} from '#routes/mcp/testing'
import { createTask, withoutLinkSync } from '#routes/tasks/testing'
import { jsonBody, passthroughSchema, setupTestDb } from '#testing'

setupTestDb()

// These tests confirm that data written through an MCP write tool is visible,
// in the same shape, through the plain REST routes the web UI reads from —
// not the MCP read tools (read-tools.integration.test.ts) and not the write
// tool's own response (write-tools.integration.test.ts).

let client: Client

beforeEach(async () => {
  client = await connectMcpClient()
})
afterEach(async () => {
  await client.close()
})

describe('REST/MCP parity', () => {
  it('a page created via create_page is visible through GET /api/tasks/:taskId/pages', async () => {
    const task = await createTask('Has pages')

    const created = await callMcpTool(client, 'create_page', {
      taskId: task.id,
      title: 'Notes',
      content: 'Some content',
    })
    const data = withoutLinkSync(
      passthroughSchema<Record<string, unknown>>().parse(
        parseToolJson(created),
      ),
    )

    const res = await app.request(`/api/tasks/${task.id}/pages`)
    expect(res.status).toBe(200)

    expect(await jsonBody(res)).toEqual([data])
  })

  it('a page updated via update_page with an explicit agent is attributed to that agent through GET /api/tasks/:taskId/pages', async () => {
    const task = await createTask('Has pages')
    const created = await callMcpTool(client, 'create_page', {
      taskId: task.id,
      title: 'Notes',
    })
    const page = passthroughSchema<{ id: string }>().parse(
      parseToolJson(created),
    )

    const updated = await callMcpTool(client, 'update_page', {
      taskId: task.id,
      pageId: page.id,
      content: 'Updated content',
      agent: 'claude-opus-5',
    })
    const data = withoutLinkSync(
      passthroughSchema<Record<string, unknown>>().parse(
        parseToolJson(updated),
      ),
    )

    const res = await app.request(`/api/tasks/${task.id}/pages`)
    expect(res.status).toBe(200)

    expect(await jsonBody(res)).toEqual([data])
  })
})
