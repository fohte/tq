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
  it('sets a one-day time override', async () => {
    const createResponse = await app.request('/api/schedule/recurring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Routine',
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
      skipped: false,
    })
  })

  it('clears a one-day time override', async () => {
    const createResponse = await app.request('/api/schedule/recurring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Routine',
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
    const createResponse = await app.request('/api/schedule/recurring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Routine',
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
      skipped: true,
    })
  })
})
