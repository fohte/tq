import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { app } from '#app'
import {
  callMcpTool,
  connectMcpClient,
  normalizeDynamicValues,
  parseToolJson,
} from '#routes/mcp/testing'
import { makeTimeBlock } from '#routes/schedule-test-fixtures'
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

function expectedToolValidationError(name: string, issue: string) {
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: `Input validation error: Invalid arguments for tool ${name}: ${issue}`,
      },
    ],
  }
}

function summarizeTimeBlockDeletion(result: unknown, remaining: unknown[]) {
  return { result, remaining }
}

async function createTimeBlock(
  taskId: string,
  startTime: string,
  endTime: string,
) {
  const response = await app.request('/api/schedule/time-blocks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId, startTime, endTime }),
  })
  return jsonBody<{ id: string } & Record<string, unknown>>(response)
}

describe('schedule operation tools', () => {
  it('registers schedule operations with matching annotations', async () => {
    const result = await client.listTools()

    expect(
      result.tools
        .filter((tool) => tool.name.startsWith('schedule_'))
        .map((tool) => ({ name: tool.name, annotations: tool.annotations }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    ).toEqual([
      {
        name: 'schedule_override_clear',
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
      {
        name: 'schedule_override_set',
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      {
        name: 'schedule_recurring_list',
        annotations: { readOnlyHint: true },
      },
      {
        name: 'schedule_time_blocks_create',
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      {
        name: 'schedule_time_blocks_delete',
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
      {
        name: 'schedule_time_blocks_list',
        annotations: { readOnlyHint: true },
      },
      {
        name: 'schedule_time_blocks_update',
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
    ])
  })

  it('lists blocks using the supplied local date range and timezone offset', async () => {
    const task = await createTask('Scheduled work')
    await createTimeBlock(
      task.id,
      '2026-12-17T20:30:00.000Z',
      '2026-12-17T21:00:00.000Z',
    )
    await createTimeBlock(
      task.id,
      '2026-12-17T19:00:00.000Z',
      '2026-12-17T19:30:00.000Z',
    )
    const expectedResponse = await app.request(
      '/api/schedule/time-blocks?startDate=2026-12-18&endDate=2026-12-18&tzOffset=-240',
    )

    const result = await callMcpTool(client, 'schedule_time_blocks_list', {
      startDate: '2026-12-18',
      endDate: '2026-12-18',
      tzOffset: -240,
    })

    expect(parseToolJson(result)).toEqual(
      await jsonBody<unknown[]>(expectedResponse),
    )
  })

  it('requires a timezone offset when listing time blocks', async () => {
    const result = await callMcpTool(client, 'schedule_time_blocks_list', {
      startDate: '2026-12-18',
      endDate: '2026-12-18',
    })

    expect(result).toEqual(
      expectedToolValidationError(
        'schedule_time_blocks_list',
        'tzOffset: Invalid input: expected number, received undefined',
      ),
    )
  })

  it('creates a time block for a task', async () => {
    const task = await createTask('Focused work')

    const result = await callMcpTool(client, 'schedule_time_blocks_create', {
      taskId: task.number,
      startTime: '2026-12-18T08:30:00.000Z',
      endTime: '2026-12-18T09:15:00.000Z',
      isAutoScheduled: true,
    })

    expect(
      normalizeDynamicValues(parseToolJson(result), {
        skipKeys: ['taskId', 'startTime', 'endTime'],
      }),
    ).toEqual(
      normalizeDynamicValues(
        makeTimeBlock({
          taskId: task.id,
          startTime: '2026-12-18T08:30:00.000Z',
          endTime: '2026-12-18T09:15:00.000Z',
          isAutoScheduled: true,
        }),
        { skipKeys: ['taskId', 'startTime', 'endTime'] },
      ),
    )
  })

  it('updates the supplied time block fields', async () => {
    const task = await createTask('Movable work')
    const block = await createTimeBlock(
      task.id,
      '2026-12-18T08:30:00.000Z',
      '2026-12-18T09:15:00.000Z',
    )

    const result = await callMcpTool(client, 'schedule_time_blocks_update', {
      id: block['id'],
      endTime: '2026-12-18T09:45:00.000Z',
      isAutoScheduled: false,
    })

    expect(
      normalizeDynamicValues(parseToolJson(result), {
        skipKeys: ['taskId', 'startTime', 'endTime'],
      }),
    ).toEqual(
      normalizeDynamicValues(
        makeTimeBlock({
          taskId: task.id,
          startTime: '2026-12-18T08:30:00.000Z',
          endTime: '2026-12-18T09:45:00.000Z',
          isAutoScheduled: false,
        }),
        { skipKeys: ['taskId', 'startTime', 'endTime'] },
      ),
    )
  })

  it('deletes the selected time block', async () => {
    const task = await createTask('Temporary work')
    const block = await createTimeBlock(
      task.id,
      '2026-12-18T08:30:00.000Z',
      '2026-12-18T09:15:00.000Z',
    )

    const result = await callMcpTool(client, 'schedule_time_blocks_delete', {
      id: block['id'],
    })
    const remainingResponse = await app.request(
      '/api/schedule/time-blocks?startDate=2026-12-18&endDate=2026-12-18&tzOffset=0',
    )
    expect(
      summarizeTimeBlockDeletion(
        parseToolJson(result),
        await jsonBody<unknown[]>(remainingResponse),
      ),
    ).toEqual({ result: { deleted: true, id: block.id }, remaining: [] })
  })

  it('lists expanded recurring schedule instances in the selected date range', async () => {
    const response = await app.request('/api/schedule/recurring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Daily reset',
        startTime: '08:45',
        endTime: '09:15',
        recurrence: { type: 'daily', interval: 1 },
      }),
    })
    const created = await jsonBody<{ id: string; recurrence: { id: string } }>(
      response,
    )

    const result = await callMcpTool(client, 'schedule_recurring_list', {
      startDate: '2026-12-18',
      endDate: '2026-12-18',
    })

    expect(
      normalizeDynamicValues(parseToolJson(result), {
        skipKeys: ['scheduleId', 'id'],
      }),
    ).toEqual([
      {
        scheduleId: created.id,
        title: 'Daily reset',
        start: '2026-12-18T08:45:00',
        end: '2026-12-18T09:15:00',
        context: 'personal',
        color: null,
        recurrence: {
          id: created.recurrence.id,
          type: 'daily',
          interval: 1,
          daysOfWeek: null,
          dayOfMonth: null,
        },
      },
    ])
  })

  it('requires explicit dates when listing recurring schedule instances', async () => {
    const result = await callMcpTool(client, 'schedule_recurring_list')

    expect(result).toEqual(
      expectedToolValidationError(
        'schedule_recurring_list',
        'startDate: Invalid input: expected string, received undefined, endDate: Invalid input: expected string, received undefined',
      ),
    )
  })

  it('limits recurring schedule queries to 31 calendar days', async () => {
    const result = await callMcpTool(client, 'schedule_recurring_list', {
      startDate: '2026-12-01',
      endDate: '2027-01-01',
    })

    expect(result).toEqual(
      expectedToolValidationError(
        'schedule_recurring_list',
        'endDate: Date range must be chronological and no longer than 31 days',
      ),
    )
  })
})
