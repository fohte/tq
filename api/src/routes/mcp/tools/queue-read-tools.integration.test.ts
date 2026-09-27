import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { app } from '#app'
import {
  callMcpTool,
  connectMcpClient,
  parseToolJson,
} from '#routes/mcp/testing'
import { createTask } from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

let client: Client

beforeEach(async () => {
  client = await connectMcpClient()
})

afterEach(async () => {
  await client.close()
})

it('declares get_today_tasks as read-only', async () => {
  const result = await client.listTools()

  expect(
    result.tools
      .filter((tool) => tool.name === 'get_today_tasks')
      .map((tool) => ({
        name: tool.name,
        readOnlyHint: tool.annotations?.readOnlyHint,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  ).toEqual([{ name: 'get_today_tasks', readOnlyHint: true }])
})

describe('get_today_tasks', () => {
  it('rejects invalid input', async () => {
    const result = await callMcpTool(client, 'get_today_tasks', {
      date: 'not-a-date',
    })

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

    const toolResult = await callMcpTool(client, 'get_today_tasks', {
      date: '2026-01-15',
    })

    expect(parseToolJson(toolResult)).toEqual(queued)
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

    const toolResult = await callMcpTool(client, 'get_today_tasks')

    expect(parseToolJson(toolResult)).toEqual(queued)
  })
})
