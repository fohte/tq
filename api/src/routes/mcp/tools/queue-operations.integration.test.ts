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

function localDate(date: Date) {
  return `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dateAtOffset(date: Date, tzOffset: number) {
  return new Date(date.getTime() - tzOffset * 60_000).toISOString().slice(0, 10)
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
      {
        name: 'queue_get',
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
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
      tzOffset: 0,
    })

    expect(result).toEqual(
      expectedToolValidationError(
        'queue_get',
        'date',
        'Invalid date format (YYYY-MM-DD)',
      ),
    )
  })

  it('requires a timezone offset when getting a queue', async () => {
    const result = await callMcpTool(client, 'queue_get', { key: 'day' })

    expect(result).toEqual(
      expectedToolValidationError(
        'queue_get',
        'tzOffset',
        'Invalid input: expected number, received undefined',
      ),
    )
  })

  it('rejects malformed queue keys before making a request', async () => {
    const invalidKeys = ['', '.', '..', '\uD800']
    const results = await Promise.all(
      invalidKeys.flatMap((key) => [
        callMcpTool(client, 'queue_get', {
          key,
          date: '2026-08-06',
          tzOffset: 0,
        }),
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

  it('rejects an identifier that is neither a UUID nor task number', async () => {
    const result = await callMcpTool(client, 'queue_set', {
      key: 'day',
      date: '2026-08-06',
      taskIds: ['not-a-uuid'],
    })

    expect(result).toEqual(
      expectedToolValidationError('queue_set', 'taskIds.0', 'Invalid input'),
    )
  })

  it('returns the selected queue for an explicit date', async () => {
    const task = await createTask('Queued item')
    const expected = await putDayQueueItems([task.id], '2026-08-06')

    const result = await callMcpTool(client, 'queue_get', {
      key: 'day',
      date: '2026-08-06',
      tzOffset: 0,
    })

    expect(parseToolJson(result)).toEqual(expected)
  })

  it("defaults to today's queue and carries unfinished items forward", async () => {
    const task = await createTask('Carry-over task')
    const todayDate = new Date()
    const yesterdayDate = new Date(todayDate)
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    const today = localDate(todayDate)
    await putDayQueueItems([task.id], localDate(yesterdayDate))

    const result = await callMcpTool(client, 'queue_get', {
      key: 'day',
      tzOffset: new Date().getTimezoneOffset(),
    })

    expect(
      normalizeDynamicValues(parseToolJson(result), { skipKeys: ['taskId'] }),
    ).toEqual([
      {
        id: '<uuid>',
        taskId: task.id,
        periodStart: today,
        sortOrder: 0,
        createdAt: '<timestamp>',
        updatedAt: '<timestamp>',
      },
    ])
  })

  it("uses the caller's timezone when defaulting to today's queue", async () => {
    const task = await createTask('Timezone carry-over task')
    const now = new Date()
    const serverToday = localDate(now)
    const tzOffset = Array.from(
      { length: 1561 },
      (_, index) => index - 720,
    ).find((offset) => dateAtOffset(now, offset) !== serverToday)
    if (tzOffset === undefined)
      throw new Error('Expected a distinct local date')
    const today = dateAtOffset(now, tzOffset)
    const yesterday = dateAtOffset(
      new Date(now.getTime() - 86_400_000),
      tzOffset,
    )
    await putDayQueueItems([task.id], yesterday)

    const result = await callMcpTool(client, 'queue_get', {
      key: 'day',
      tzOffset,
    })

    expect(
      normalizeDynamicValues(parseToolJson(result), { skipKeys: ['taskId'] }),
    ).toEqual([
      {
        id: '<uuid>',
        taskId: task.id,
        periodStart: today,
        sortOrder: 0,
        createdAt: '<timestamp>',
        updatedAt: '<timestamp>',
      },
    ])
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

  it('accepts task numbers and deduplicates UUID aliases', async () => {
    const taskA = await createTask('First numbered item')
    const taskB = await createTask('Second numbered item')

    const result = await callMcpTool(client, 'queue_set', {
      key: 'day',
      date: '2026-08-06',
      taskIds: [taskB.number, String(taskA.number), taskB.id],
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
