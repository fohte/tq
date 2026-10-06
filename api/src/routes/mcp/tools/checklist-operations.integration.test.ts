import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import {
  mockGithubIssueResponse,
  upsertGithubToken,
} from '#integrations/github/testing'
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
  vi.restoreAllMocks()
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

  it('accepts a pull request URL when adding an item', async () => {
    const task = await createTask('Checklist task')
    const checklist = z.object({ id: z.uuid() }).parse(
      parseToolJson(
        await callMcpTool(client, 'checklist_create', {
          taskId: task.number,
        }),
      ),
    )
    const githubUrl = 'https://github.com/example-owner/example-repo/pull/73'
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse({ html_url: githubUrl, pull_request: {} })

    const item = parseToolJson(
      await callMcpTool(client, 'checklist_item_add', {
        checklistId: checklist.id,
        content: 'Add the API route',
        github: githubUrl,
      }),
    )

    expect(normalizeDynamicValues(item)).toEqual({
      id: '<uuid>',
      checklistId: '<uuid>',
      parentItemId: null,
      content: 'Add the API route',
      note: null,
      checkedAt: null,
      sortOrder: 0,
      githubLinkId: '<uuid>',
      subtaskId: null,
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })
  })
})
