import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'

import {
  callMcpTool,
  connectMcpClient,
  normalizeDynamicValues,
  parseToolJson,
} from '#routes/mcp/testing'
import { createTask } from '#routes/tasks/testing'
import { setupTestDb } from '#testing'

setupTestDb()

let client: Client

beforeEach(async () => {
  client = await connectMcpClient()
})

afterEach(async () => {
  await client.close()
})

describe('checklist MCP operations', () => {
  it('accepts task numbers and exposes nested checklist items through operations', async () => {
    const task = await createTask('Checklist task')
    const createdChecklist = parseToolJson(
      await callMcpTool(client, 'checklist_create', {
        taskId: task.number,
        name: 'Preparation',
      }),
    )
    const checklist = z.object({ id: z.uuid() }).parse(createdChecklist)

    const addedItem = parseToolJson(
      await callMcpTool(client, 'checklist_item_add', {
        checklistId: checklist.id,
        content: 'Prepare materials',
        note: 'Markdown detail',
      }),
    )
    const item = z.object({ id: z.uuid() }).parse(addedItem)
    const checked = await callMcpTool(client, 'checklist_item_check', {
      itemId: item.id,
    })
    const listed = await callMcpTool(client, 'checklist_list', {
      taskId: task.number,
    })

    expect(
      normalizeDynamicValues({
        checked: parseToolJson(checked),
        listed: parseToolJson(listed),
      }),
    ).toEqual({
      checked: {
        id: '<uuid>',
        checklistId: '<uuid>',
        parentItemId: null,
        content: 'Prepare materials',
        note: 'Markdown detail',
        checkedAt: '<timestamp>',
        sortOrder: 0,
        githubLinkId: null,
        subtaskId: null,
        createdAt: '<timestamp>',
        updatedAt: '<timestamp>',
      },
      listed: [
        {
          id: '<uuid>',
          taskId: '<uuid>',
          name: 'Preparation',
          sortOrder: 0,
          createdAt: '<timestamp>',
          updatedAt: '<timestamp>',
          items: [
            {
              id: '<uuid>',
              checklistId: '<uuid>',
              parentItemId: null,
              content: 'Prepare materials',
              note: 'Markdown detail',
              checkedAt: '<timestamp>',
              sortOrder: 0,
              githubLinkId: null,
              subtaskId: null,
              createdAt: '<timestamp>',
              updatedAt: '<timestamp>',
              children: [],
            },
          ],
        },
      ],
    })
  })
})
