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
import {
  makeScheduleEvent,
  makeScheduleOccurrence,
  makeTimeBlock,
} from '#routes/schedule-test-fixtures'
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
  it('previews an event update without saving it', async () => {
    const created = await callMcpTool(client, 'schedule_events_create', {
      title: 'Review block',
      startDate: '2038-02-03',
      startTime: '08:30',
      endTime: '09:30',
    })
    const schedule = z.object({ id: z.uuid() }).parse(parseToolJson(created))
    const updateInput = {
      id: schedule.id,
      effectiveFrom: '2038-02-03',
      startTime: '10:00',
      endTime: '11:00',
    }

    const preview = await callMcpTool(client, 'schedule_events_update', {
      ...updateInput,
      dryRun: true,
    })
    const beforeSave = await callMcpTool(client, 'schedule_events_list', {
      startDate: '2038-02-03',
      endDate: '2038-02-03',
    })
    const saved = await callMcpTool(
      client,
      'schedule_events_update',
      updateInput,
    )
    const afterSave = await callMcpTool(client, 'schedule_events_list', {
      startDate: '2038-02-03',
      endDate: '2038-02-03',
    })

    const snapshot = () => ({
      preview: parseToolJson(preview),
      beforeSave: normalizeDynamicValues(parseToolJson(beforeSave)),
      saved: normalizeDynamicValues(parseToolJson(saved)),
      afterSave: normalizeDynamicValues(parseToolJson(afterSave)),
    })
    expect(snapshot()).toEqual({
      preview: {
        range: { startDate: '2038-02-03', endDate: '2038-03-16' },
        changes: [
          {
            before: {
              date: '2038-02-03',
              originalDate: '2038-02-03',
              startTime: '08:30',
              endTime: '09:30',
              skipped: false,
            },
            after: {
              date: '2038-02-03',
              originalDate: '2038-02-03',
              startTime: '10:00',
              endTime: '11:00',
              skipped: false,
            },
          },
        ],
        deletedOverrides: [],
      },
      beforeSave: [
        makeScheduleOccurrence({
          scheduleId: '<uuid>',
          title: 'Review block',
          startDate: '2038-02-03',
          start: '2038-02-03T08:30:00',
          end: '2038-02-03T09:30:00',
          context: 'personal',
          color: null,
          occurrenceDate: '2038-02-03',
          overridden: null,
          recurrence: null,
        }),
      ],
      saved: {
        id: '<uuid>',
        title: 'Review block',
        startDate: '2038-02-03',
        endDate: null,
        startTime: '10:00',
        endTime: '11:00',
        recurrence: null,
        remindBeforeMinutes: null,
        context: 'personal',
        color: null,
        constraintViolations: [],
        createdAt: '<timestamp>',
        updatedAt: '<timestamp>',
      },
      afterSave: [
        makeScheduleOccurrence({
          scheduleId: '<uuid>',
          title: 'Review block',
          startDate: '2038-02-03',
          start: '2038-02-03T10:00:00',
          end: '2038-02-03T11:00:00',
          context: 'personal',
          color: null,
          occurrenceDate: '2038-02-03',
          overridden: null,
          recurrence: null,
        }),
      ],
    })
  })

  it('registers schedule operations with matching annotations', async () => {
    const result = await client.listTools()

    expect(
      result.tools
        .filter((tool) => tool.name.startsWith('schedule_'))
        .map((tool) => ({ name: tool.name, annotations: tool.annotations }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    ).toEqual([
      {
        name: 'schedule_constraints_check',
        annotations: { readOnlyHint: true },
      },
      {
        name: 'schedule_events_create',
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      {
        name: 'schedule_events_delete',
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
      {
        name: 'schedule_events_list',
        annotations: { readOnlyHint: true },
      },
      {
        name: 'schedule_events_update',
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      {
        name: 'schedule_override_clear',
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
      {
        name: 'schedule_override_set',
        annotations: { readOnlyHint: false, destructiveHint: false },
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

  it('describes the required start date and recurrence behavior', async () => {
    const result = await client.listTools()

    expect(
      result.tools.find((tool) => tool.name === 'schedule_events_create')
        ?.description,
    ).toBe(
      'Create a schedule event starting on the required local startDate (YYYY-MM-DD). startTime and endTime are local HH:MM times; if endTime is earlier than startTime, it ends the following day. remindBeforeMinutes optionally sends a push notification that many minutes before each occurrence starts. Without recurrence, the event appears only on startDate. For recurrence, daily and custom rules appear every day starting on startDate, weekly rules use daysOfWeek (0 = Sunday through 6 = Saturday), and monthly rules use dayOfMonth. interval is stored but does not affect schedule event dates yet.',
    )
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

  it('rejects time block ranges longer than 42 calendar days', async () => {
    const result = await callMcpTool(client, 'schedule_time_blocks_list', {
      startDate: '2099-01-01',
      endDate: '2099-02-12',
      tzOffset: 0,
    })

    expect(result).toEqual(
      expectedToolValidationError(
        'schedule_time_blocks_list',
        'endDate: Date range must be chronological and no longer than 42 days',
      ),
    )
  })

  it('creates a time block for a task number', async () => {
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

  it('creates a time block for a task UUID', async () => {
    const task = await createTask('Focused work')

    const result = await callMcpTool(client, 'schedule_time_blocks_create', {
      taskId: task.id,
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

  it('lists schedule events in the selected date range', async () => {
    const response = await app.request('/api/schedule/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Daily reset',
        startDate: '2026-12-18',
        startTime: '08:45',
        endTime: '09:15',
        recurrence: { type: 'daily', interval: 1 },
      }),
    })
    const created = await jsonBody<{ id: string; recurrence: { id: string } }>(
      response,
    )

    const result = await callMcpTool(client, 'schedule_events_list', {
      startDate: '2026-12-18',
      endDate: '2026-12-18',
    })

    expect(
      normalizeDynamicValues(parseToolJson(result), {
        skipKeys: ['scheduleId', 'id'],
      }),
    ).toEqual([
      makeScheduleOccurrence({
        scheduleId: created.id,
        title: 'Daily reset',
        startDate: '2026-12-18',
        start: '2026-12-18T08:45:00',
        end: '2026-12-18T09:15:00',
        context: 'personal',
        color: null,
        occurrenceDate: '2026-12-18',
        overridden: null,
        recurrence: {
          id: created.recurrence.id,
          type: 'daily',
          interval: 1,
          daysOfWeek: null,
          dayOfMonth: null,
        },
      }),
    ])
  })

  it('creates a schedule event and returns the API response', async () => {
    const result = await callMcpTool(client, 'schedule_events_create', {
      title: 'Draft agenda',
      startDate: '2026-12-18',
      startTime: '08:45',
      endTime: '09:15',
      recurrence: {
        type: 'weekly',
        interval: 1,
        daysOfWeek: [1, 3, 5],
      },
      context: 'work',
      color: '#b9c0ca',
      remindBeforeMinutes: 45,
    })

    expect(normalizeDynamicValues(parseToolJson(result))).toEqual(
      normalizeDynamicValues(
        makeScheduleEvent({
          title: 'Draft agenda',
          startDate: '2026-12-18',
          recurrence: {
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            type: 'weekly',
            interval: 1,
            daysOfWeek: [1, 3, 5],
            dayOfMonth: null,
          },
          context: 'work',
          color: '#b9c0ca',
          remindBeforeMinutes: 45,
        }),
      ),
    )
  })

  it('updates a schedule from an effective date and lists the new occurrences', async () => {
    const created = await callMcpTool(client, 'schedule_events_create', {
      title: 'Focus block',
      startDate: '2026-12-18',
      startTime: '08:00',
      endTime: '09:00',
      recurrence: { type: 'daily', interval: 1 },
    })
    const schedule = z.object({ id: z.uuid() }).parse(parseToolJson(created))

    const updated = await callMcpTool(client, 'schedule_events_update', {
      id: schedule.id,
      effectiveFrom: '2026-12-20',
      startTime: '09:30',
      endTime: '10:00',
      endDate: '2026-12-20',
      recurrence: { type: 'weekly', interval: 1, daysOfWeek: [0] },
      remindBeforeMinutes: 90,
    })
    const events = await callMcpTool(client, 'schedule_events_list', {
      startDate: '2026-12-18',
      endDate: '2026-12-21',
    })

    const snapshot = () => ({
      updated: normalizeDynamicValues(parseToolJson(updated)),
      events: normalizeDynamicValues(parseToolJson(events)),
    })

    expect(snapshot()).toEqual({
      updated: {
        id: '<uuid>',
        title: 'Focus block',
        startDate: '2026-12-18',
        endDate: '2026-12-20',
        startTime: '09:30',
        endTime: '10:00',
        recurrence: {
          id: '<uuid>',
          type: 'weekly',
          interval: 1,
          daysOfWeek: [0],
          dayOfMonth: null,
        },
        context: 'personal',
        color: null,
        constraintViolations: [],
        remindBeforeMinutes: 90,
        createdAt: '<timestamp>',
        updatedAt: '<timestamp>',
      },
      events: [
        makeScheduleOccurrence({
          scheduleId: '<uuid>',
          title: 'Focus block',
          startDate: '2026-12-18',
          start: '2026-12-18T08:00:00',
          end: '2026-12-18T09:00:00',
          remindBeforeMinutes: 90,
          context: 'personal',
          color: null,
          occurrenceDate: '2026-12-18',
          overridden: null,
          recurrence: {
            id: '<uuid>',
            type: 'daily',
            interval: 1,
            daysOfWeek: null,
            dayOfMonth: null,
          },
        }),
        makeScheduleOccurrence({
          scheduleId: '<uuid>',
          title: 'Focus block',
          startDate: '2026-12-18',
          start: '2026-12-19T08:00:00',
          end: '2026-12-19T09:00:00',
          remindBeforeMinutes: 90,
          context: 'personal',
          color: null,
          occurrenceDate: '2026-12-19',
          overridden: null,
          recurrence: {
            id: '<uuid>',
            type: 'daily',
            interval: 1,
            daysOfWeek: null,
            dayOfMonth: null,
          },
        }),
        makeScheduleOccurrence({
          scheduleId: '<uuid>',
          title: 'Focus block',
          startDate: '2026-12-18',
          start: '2026-12-20T09:30:00',
          end: '2026-12-20T10:00:00',
          remindBeforeMinutes: 90,
          context: 'personal',
          color: null,
          occurrenceDate: '2026-12-20',
          overridden: null,
          recurrence: {
            id: '<uuid>',
            type: 'weekly',
            interval: 1,
            daysOfWeek: [0],
            dayOfMonth: null,
          },
        }),
      ],
    })
  })

  it('clears a schedule reminder', async () => {
    const created = await callMcpTool(client, 'schedule_events_create', {
      title: 'Planning session',
      startDate: '2026-12-18',
      startTime: '08:45',
      endTime: '09:15',
      remindBeforeMinutes: 45,
    })
    const schedule = z.object({ id: z.uuid() }).parse(parseToolJson(created))

    const updated = await callMcpTool(client, 'schedule_events_update', {
      id: schedule.id,
      remindBeforeMinutes: null,
    })

    expect(normalizeDynamicValues(parseToolJson(updated))).toEqual(
      normalizeDynamicValues(
        makeScheduleEvent({
          title: 'Planning session',
          startDate: '2026-12-18',
          startTime: '08:45',
          endTime: '09:15',
          remindBeforeMinutes: null,
        }),
      ),
    )
  })

  it('deletes a schedule event', async () => {
    const created = await callMcpTool(client, 'schedule_events_create', {
      title: 'Temporary event',
      startDate: '2026-12-18',
      startTime: '08:00',
      endTime: '09:00',
    })
    const schedule = z.object({ id: z.uuid() }).parse(parseToolJson(created))

    const deleted = await callMcpTool(client, 'schedule_events_delete', {
      id: schedule.id,
    })
    const events = await callMcpTool(client, 'schedule_events_list', {
      startDate: '2026-12-18',
      endDate: '2026-12-18',
    })

    const snapshot = () => ({
      deleted: parseToolJson(deleted),
      events: parseToolJson(events),
    })

    expect(snapshot()).toEqual({
      deleted: { deleted: true, id: schedule.id },
      events: [],
    })
  })

  it('rejects invalid schedule event times', async () => {
    const result = await callMcpTool(client, 'schedule_events_create', {
      title: 'Draft agenda',
      startDate: '2026-12-18',
      startTime: '8:45',
      endTime: '09:15',
    })

    expect(result).toEqual(
      expectedToolValidationError(
        'schedule_events_create',
        'startTime: Invalid string: must match pattern /^(?:[01]\\d|2[0-3]):[0-5]\\d$/',
      ),
    )
  })

  it('requires a start date when creating schedule events', async () => {
    const result = await callMcpTool(client, 'schedule_events_create', {
      title: 'Draft agenda',
      startTime: '08:45',
      endTime: '09:15',
    })

    expect(result).toEqual(
      expectedToolValidationError(
        'schedule_events_create',
        'startDate: Invalid input: expected string, received undefined',
      ),
    )
  })

  it('lists a one-off schedule event only on its start date', async () => {
    await callMcpTool(client, 'schedule_events_create', {
      title: 'One-off focus',
      startDate: '2026-12-18',
      startTime: '08:45',
      endTime: '09:15',
    })

    const result = await callMcpTool(client, 'schedule_events_list', {
      startDate: '2026-12-17',
      endDate: '2026-12-19',
    })

    expect(normalizeDynamicValues(parseToolJson(result))).toEqual([
      makeScheduleOccurrence({
        scheduleId: '<uuid>',
        title: 'One-off focus',
        startDate: '2026-12-18',
        start: '2026-12-18T08:45:00',
        end: '2026-12-18T09:15:00',
        context: 'personal',
        color: null,
        occurrenceDate: '2026-12-18',
        overridden: null,
        recurrence: null,
      }),
    ])
  })

  it('requires explicit dates when listing schedule events', async () => {
    const result = await callMcpTool(client, 'schedule_events_list')

    expect(result).toEqual(
      expectedToolValidationError(
        'schedule_events_list',
        'startDate: Invalid input: expected string, received undefined, endDate: Invalid input: expected string, received undefined',
      ),
    )
  })

  it('limits schedule event queries to 42 calendar days', async () => {
    const result = await callMcpTool(client, 'schedule_events_list', {
      startDate: '2099-01-01',
      endDate: '2099-02-12',
    })

    expect(result).toEqual(
      expectedToolValidationError(
        'schedule_events_list',
        'endDate: Date range must be chronological and no longer than 42 days',
      ),
    )
  })
})
