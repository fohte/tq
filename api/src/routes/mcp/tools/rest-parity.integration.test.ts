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

let client: Client

beforeEach(async () => {
  client = await connectMcpClient()
})

afterEach(async () => {
  await client.close()
})

describe('REST/MCP parity', () => {
  it('a comment created via comment_create is visible through GET /api/tasks/:taskId/comments', async () => {
    const task = await createTask('Has comments')

    const created = await callMcpTool(client, 'comment_create', {
      taskId: task.id,
      content: 'A comment',
    })
    const data = withoutLinkSync(
      passthroughSchema<Record<string, unknown>>().parse(
        parseToolJson(created),
      ),
    )

    const res = await app.request(`/api/tasks/${task.id}/comments`)
    expect(res.status).toBe(200)

    expect(await jsonBody(res)).toEqual([data])
  })

  it('a comment updated via comment_update with an explicit agent is attributed to that agent through GET /api/tasks/:taskId/comments', async () => {
    const task = await createTask('Has comments')
    const created = await callMcpTool(client, 'comment_create', {
      taskId: task.id,
      content: 'Original content',
    })
    const comment = passthroughSchema<{ id: string }>().parse(
      parseToolJson(created),
    )

    const updated = await callMcpTool(client, 'comment_update', {
      taskId: task.id,
      commentId: comment.id,
      content: 'Updated content',
      agent: 'claude-opus-5',
    })
    const data = withoutLinkSync(
      passthroughSchema<Record<string, unknown>>().parse(
        parseToolJson(updated),
      ),
    )

    const res = await app.request(`/api/tasks/${task.id}/comments`)
    expect(res.status).toBe(200)

    expect(await jsonBody(res)).toEqual([data])
  })
})
