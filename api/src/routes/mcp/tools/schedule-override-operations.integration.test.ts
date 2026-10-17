import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { app } from '#app'
import {
  callMcpTool,
  connectMcpClient,
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

describe('schedule override operation tools', () => {
  it('previews an occurrence change without saving it', async () => {
    const occurrenceDate = '2038-02-03'
    const destinationDate = '2038-02-05'
    const createResponse = await app.request('/api/schedule/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Review block',
        startDate: occurrenceDate,
        startTime: '08:30',
        endTime: '09:30',
        recurrence: { type: 'daily', interval: 1 },
      }),
    })
    const schedule = await jsonBody<{ id: string }>(createResponse)

    const preview = await callMcpTool(client, 'schedule_override_set', {
      scheduleId: schedule.id,
      occurrenceDate,
      date: destinationDate,
      startTime: '10:00',
      endTime: '11:00',
      dryRun: true,
    })
    const saved = await callMcpTool(client, 'schedule_override_set', {
      scheduleId: schedule.id,
      occurrenceDate,
      date: destinationDate,
      startTime: '10:00',
      endTime: '11:00',
    })

    const snapshot = () => ({
      preview: parseToolJson(preview),
      saved: parseToolJson(saved),
    })
    expect(snapshot()).toEqual({
      preview: {
        range: { startDate: occurrenceDate, endDate: destinationDate },
        changes: [
          {
            before: {
              date: occurrenceDate,
              originalDate: occurrenceDate,
              startTime: '08:30',
              endTime: '09:30',
              skipped: false,
            },
            after: {
              date: destinationDate,
              originalDate: occurrenceDate,
              startTime: '10:00',
              endTime: '11:00',
              skipped: false,
            },
          },
        ],
        deletedOverrides: [],
      },
      saved: {
        scheduleId: schedule.id,
        occurrenceDate,
        startTime: '10:00',
        endTime: '11:00',
        movedToDate: destinationDate,
        skipped: false,
        constraintViolations: [],
      },
    })
  })

  it('sets a one-day time override', async () => {
    const createResponse = await app.request('/api/schedule/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Routine',
        startDate: '2026-03-22',
        startTime: '09:00',
        endTime: '10:00',
      }),
    })
    const schedule = await jsonBody<{ id: string }>(createResponse)

    const setResult = await callMcpTool(client, 'schedule_override_set', {
      scheduleId: schedule.id,
      occurrenceDate: '2026-03-22',
      startTime: '08:30',
      endTime: '09:45',
    })
    expect(parseToolJson(setResult)).toEqual({
      scheduleId: schedule.id,
      occurrenceDate: '2026-03-22',
      startTime: '08:30',
      endTime: '09:45',
      movedToDate: null,
      skipped: false,
      constraintViolations: [],
    })
  })

  it('moves one occurrence to a destination date', async () => {
    const createResponse = await app.request('/api/schedule/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Routine',
        startDate: '2034-08-17',
        startTime: '09:00',
        endTime: '10:00',
        recurrence: { type: 'daily', interval: 1 },
      }),
    })
    const schedule = await jsonBody<{ id: string }>(createResponse)

    const result = await callMcpTool(client, 'schedule_override_set', {
      scheduleId: schedule.id,
      occurrenceDate: '2034-08-17',
      date: '2034-08-19',
      startTime: '09:00',
      endTime: '10:00',
    })

    expect(parseToolJson(result)).toEqual({
      scheduleId: schedule.id,
      occurrenceDate: '2034-08-17',
      startTime: '09:00',
      endTime: '10:00',
      movedToDate: '2034-08-19',
      skipped: false,
      constraintViolations: [],
    })
  })

  it('clears a one-day time override', async () => {
    const createResponse = await app.request('/api/schedule/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Routine',
        startDate: '2026-03-22',
        startTime: '09:00',
        endTime: '10:00',
      }),
    })
    const schedule = await jsonBody<{ id: string }>(createResponse)
    await callMcpTool(client, 'schedule_override_set', {
      scheduleId: schedule.id,
      occurrenceDate: '2026-03-22',
      startTime: '08:30',
      endTime: '09:45',
    })

    const clearResult = await callMcpTool(client, 'schedule_override_clear', {
      scheduleId: schedule.id,
      occurrenceDate: '2026-03-22',
    })

    expect(parseToolJson(clearResult)).toEqual({
      cleared: true,
      scheduleId: schedule.id,
      occurrenceDate: '2026-03-22',
    })
  })

  it('sets a skipped occurrence without time values', async () => {
    const createResponse = await app.request('/api/schedule/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Routine',
        startDate: '2026-03-22',
        startTime: '09:00',
        endTime: '10:00',
      }),
    })
    const schedule = await jsonBody<{ id: string }>(createResponse)

    const result = await callMcpTool(client, 'schedule_override_set', {
      scheduleId: schedule.id,
      occurrenceDate: '2026-03-22',
      mode: 'skip',
    })

    expect(parseToolJson(result)).toEqual({
      scheduleId: schedule.id,
      occurrenceDate: '2026-03-22',
      startTime: null,
      endTime: null,
      movedToDate: null,
      skipped: true,
      constraintViolations: [],
    })
  })

  it('rejects a destination date when skipping an occurrence', async () => {
    const result = await callMcpTool(client, 'schedule_override_set', {
      scheduleId: 'test-schedule',
      occurrenceDate: '2034-08-17',
      date: '2034-08-19',
      mode: 'skip',
    })

    expect(result).toEqual({
      isError: true,
      content: [
        {
          type: 'text',
          text: 'Invalid request: Omit date, startTime, and endTime when mode is skip.',
        },
      ],
    })
  })
})
