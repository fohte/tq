import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { app } from '#app'
import {
  callMcpTool,
  connectMcpClient,
  expectedPathSegmentValidationError,
  normalizeDynamicValues,
  parseToolJson,
} from '#routes/mcp/testing'
import { createTask } from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

async function putDayQueueItems(taskIds: string[], date: string) {
  const response = await app.request('/api/queues/day/items', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskIds, date }),
  })
  return jsonBody<Record<string, unknown>[]>(response)
}

function expectedToolValidationError(
  name: string,
  field: string,
  issue: string,
) {
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: `Input validation error: Invalid arguments for tool ${name}: ${field}: ${issue}`,
      },
    ],
  }
}

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
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
    ])
  })

  it('lists the available queues', async () => {
    const expected = await jsonBody<unknown[]>(await app.request('/api/queues'))
    const result = await callMcpTool(client, 'queue_list')

    expect(parseToolJson(result)).toEqual(expected)
  })

  it('rejects an invalid date when getting a queue', async () => {
    const result = await callMcpTool(client, 'queue_get', {
      key: 'day',
      date: 'not-a-date',
    })

    expect(result).toEqual(
      expectedToolValidationError(
        'queue_get',
        'date',
        'Invalid date format (YYYY-MM-DD)',
      ),
    )
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

    expect(results).toEqual(
      invalidKeys.flatMap((key) => [
        expectedPathSegmentValidationError(
          'queue_get',
          'key',
          'Queue key',
          key,
        ),
        expectedPathSegmentValidationError(
          'queue_set',
          'key',
          'Queue key',
          key,
        ),
      ]),
    )
  })

  it('rejects an invalid date when setting a queue', async () => {
    const result = await callMcpTool(client, 'queue_set', {
      key: 'day',
      date: 'not-a-date',
      taskIds: [],
    })

    expect(result).toEqual(
      expectedToolValidationError(
        'queue_set',
        'date',
        'Invalid date format (YYYY-MM-DD)',
      ),
    )
  })

  it('rejects a non-UUID task ID when setting a queue', async () => {
    const result = await callMcpTool(client, 'queue_set', {
      key: 'day',
      date: '2026-08-06',
      taskIds: ['not-a-uuid'],
    })

    expect(result).toEqual(
      expectedToolValidationError('queue_set', 'taskIds.0', 'Invalid UUID'),
    )
  })

  it('returns the selected queue for an explicit date', async () => {
    const task = await createTask('Queued item')
    const expected = await putDayQueueItems([task.id], '2026-08-06')

    const result = await callMcpTool(client, 'queue_get', {
      key: 'day',
      date: '2026-08-06',
    })

    expect(parseToolJson(result)).toEqual(expected)
  })

  it('uses the current UTC date when date is omitted', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const task = await createTask('Today item')
    const expected = await putDayQueueItems([task.id], today)

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
