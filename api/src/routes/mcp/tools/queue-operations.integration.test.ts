import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { app } from '#app'
import {
  callMcpTool,
  connectMcpClient,
  normalizeDynamicValues,
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

describe('queue operation tools', () => {
  it('registers each queue operation with its matching annotation', async () => {
    const result = await client.listTools()

    expect(
      result.tools
        .filter((tool) => tool.name.startsWith('queue_'))
        .map((tool) => ({ name: tool.name, annotations: tool.annotations }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    ).toEqual([
      { name: 'queue_get', annotations: { readOnlyHint: true } },
      { name: 'queue_list', annotations: { readOnlyHint: true } },
      {
        name: 'queue_set',
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
    ])
  })

  it('lists the available queues', async () => {
    const expected = await jsonBody<unknown[]>(await app.request('/api/queues'))
    const result = await callMcpTool(client, 'queue_list')

    expect(parseToolJson(result)).toEqual(expected)
  })

  it('rejects an invalid date', async () => {
    const result = await callMcpTool(client, 'queue_get', {
      key: 'day',
      date: 'not-a-date',
    })

    expect(result.isError).toEqual(true)
  })

  it('rejects malformed queue keys before making a request', async () => {
    const invalidKeys = ['', '.', '..', '\uD800']
    const results = await Promise.all(
      invalidKeys.flatMap((key) => [
        callMcpTool(client, 'queue_get', { key }),
        callMcpTool(client, 'queue_set', {
          key,
          date: '2026-08-06',
          taskIds: [],
        }),
      ]),
    )

    expect(results.map(({ isError }) => isError)).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
    ])
  })

  it('rejects invalid dates and task UUIDs when setting a queue', async () => {
    const results = await Promise.all([
      callMcpTool(client, 'queue_set', {
        key: 'day',
        date: 'not-a-date',
        taskIds: [],
      }),
      callMcpTool(client, 'queue_set', {
        key: 'day',
        date: '2026-08-06',
        taskIds: ['not-a-uuid'],
      }),
    ])

    expect(results.map(({ isError }) => isError)).toEqual([true, true])
  })

  it('returns the selected queue for an explicit date', async () => {
    const task = await createTask('Queued item')
    const putRes = await app.request('/api/queues/day/items', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskIds: [task.id], date: '2026-08-06' }),
    })
    const expected = await jsonBody<Record<string, unknown>[]>(putRes)

    const result = await callMcpTool(client, 'queue_get', {
      key: 'day',
      date: '2026-08-06',
    })

    expect(parseToolJson(result)).toEqual(expected)
  })

  it('uses the current UTC date when date is omitted', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const task = await createTask('Today item')
    const putRes = await app.request('/api/queues/day/items', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskIds: [task.id], date: today }),
    })
    const expected = await jsonBody<Record<string, unknown>[]>(putRes)

    const result = await callMcpTool(client, 'queue_get', { key: 'day' })

    expect(parseToolJson(result)).toEqual(expected)
  })

  it('replaces queue items in the supplied order', async () => {
    const taskA = await createTask('First queued item')
    const taskB = await createTask('Second queued item')

    const result = await callMcpTool(client, 'queue_set', {
      key: 'day',
      date: '2026-08-06',
      taskIds: [taskB.id, taskA.id],
    })

    expect(
      normalizeDynamicValues(parseToolJson(result), { skipKeys: ['taskId'] }),
    ).toEqual([
      {
        id: '<uuid>',
        taskId: taskB.id,
        periodStart: '2026-08-06',
        sortOrder: 0,
        createdAt: '<timestamp>',
        updatedAt: '<timestamp>',
      },
      {
        id: '<uuid>',
        taskId: taskA.id,
        periodStart: '2026-08-06',
        sortOrder: 1,
        createdAt: '<timestamp>',
        updatedAt: '<timestamp>',
      },
    ])
  })
})
