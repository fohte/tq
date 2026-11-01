import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { app } from '#app'
import { db } from '#db/connection'
import { tasks } from '#db/schema'
import {
  callMcpTool,
  connectMcpClient,
  normalizeDynamicValues,
  parseToolJson,
} from '#routes/mcp/testing'
import { generateDueRecurringTasks } from '#services/recurring-task-generator'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

let client: Awaited<ReturnType<typeof connectMcpClient>>

beforeEach(async () => {
  client = await connectMcpClient()
})

afterEach(async () => {
  await client.close()
  vi.useRealTimers()
})

async function createRecurringTemplate() {
  const response = await app.request('/api/recurring-task-templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Original review {date}',
      recurrenceRule: { type: 'daily', interval: 1 },
      anchorDate: '2031-04-09',
    }),
  })
  return jsonBody(response, z.object({ id: z.uuid() }))
}

function summarizeTemplateGeneration<Tasks>(
  updated: Awaited<ReturnType<typeof callMcpTool>>,
  generatedTasks: Tasks,
) {
  return {
    updated: normalizeDynamicValues(parseToolJson(updated)),
    generatedTasks,
  }
}

describe('recurring template operation tools', () => {
  it('uses an updated title for the next generated task', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2031-04-10T12:00:00Z'))
    const template = await createRecurringTemplate()

    const updated = await callMcpTool(client, 'recurring_template_update', {
      id: template.id,
      title: 'Revised review {date}',
    })
    await generateDueRecurringTasks()

    const generatedTasks = await db
      .select({
        title: tasks.title,
        dueDate: tasks.dueDate,
        occurrenceDate: tasks.occurrenceDate,
      })
      .from(tasks)
      .where(eq(tasks.templateId, template.id))

    expect(summarizeTemplateGeneration(updated, generatedTasks)).toEqual({
      updated: {
        id: '<uuid>',
        title: 'Revised review {date}',
        description: null,
        projectId: null,
        parentId: null,
        context: 'personal',
        labels: [],
        recurrenceRuleId: '<uuid>',
        recurrenceRule: {
          id: '<uuid>',
          type: 'daily',
          interval: 1,
          daysOfWeek: null,
          dayOfMonth: null,
        },
        startOffsetDays: null,
        anchorDate: '2031-04-09',
        lastGeneratedDate: null,
        enabled: true,
        createdAt: '<timestamp>',
        updatedAt: '<timestamp>',
      },
      generatedTasks: [
        {
          title: 'Revised review 2031-04-10',
          dueDate: '2031-04-10',
          occurrenceDate: '2031-04-10',
        },
      ],
    })
  }, 10_000)
})
