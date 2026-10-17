import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { app } from '#app'
import {
  callMcpTool,
  connectMcpClient,
  parseToolJson,
} from '#routes/mcp/testing'
import { makeScheduleConstraint } from '#services/schedule-constraint-test-fixtures'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

let client: Client

beforeEach(async () => {
  client = await connectMcpClient()
})

afterEach(async () => {
  await client.close()
})

const CONSTRAINTS = makeScheduleConstraint()

async function createSchedule(): Promise<string> {
  const response = await app.request('/api/schedule/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Routine',
      startDate: '2038-02-03',
      startTime: '18:00',
      endTime: '19:00',
    }),
  })
  const schedule = await jsonBody<{ id: string }>(response)
  return schedule.id
}

describe('schedule constraint operation tools', () => {
  it('gets, sets, and deletes constraints through the registered tools', async () => {
    const id = await createSchedule()
    const beforeSet = await callMcpTool(client, 'schedule_constraints_get', {
      id,
    })
    const saved = await callMcpTool(client, 'schedule_constraints_set', {
      id,
      constraints: CONSTRAINTS,
    })
    const afterSet = await callMcpTool(client, 'schedule_constraints_get', {
      id,
    })
    const deleted = await callMcpTool(client, 'schedule_constraints_delete', {
      id,
    })
    const afterDelete = await callMcpTool(client, 'schedule_constraints_get', {
      id,
    })

    const snapshot = () => ({
      beforeSet: parseToolJson(beforeSet),
      saved: parseToolJson(saved),
      afterSet: parseToolJson(afterSet),
      deleted: parseToolJson(deleted),
      afterDelete: parseToolJson(afterDelete),
    })
    expect(snapshot()).toEqual({
      beforeSet: { constraint: null },
      saved: { constraint: CONSTRAINTS, constraintViolations: [] },
      afterSet: { constraint: CONSTRAINTS },
      deleted: { deleted: true, id },
      afterDelete: { constraint: null },
    })
  })

  it('registers constraint tools with matching annotations', async () => {
    const result = await client.listTools()

    expect(
      result.tools
        .filter((tool) => tool.name.startsWith('schedule_constraints_'))
        .map((tool) => ({ name: tool.name, annotations: tool.annotations }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    ).toEqual([
      {
        name: 'schedule_constraints_check',
        annotations: { readOnlyHint: true },
      },
      {
        name: 'schedule_constraints_delete',
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
      {
        name: 'schedule_constraints_get',
        annotations: { readOnlyHint: true },
      },
      {
        name: 'schedule_constraints_set',
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
    ])
  })
})
