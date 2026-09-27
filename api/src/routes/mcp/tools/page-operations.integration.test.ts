import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  callMcpTool,
  connectMcpClient,
  normalizeDynamicValues,
  parseToolJson,
} from '#routes/mcp/testing'
import {
  createComment,
  createPage,
  createTask,
  TEST_UUID,
} from '#routes/tasks/testing'
import { setupTestDb } from '#testing'

setupTestDb()

let client: Client

beforeEach(async () => {
  client = await connectMcpClient()
})

afterEach(async () => {
  await client.close()
})

it('registers page read operations as read-only', async () => {
  const result = await client.listTools()

  expect(
    result.tools
      .filter((tool) =>
        ['page_get', 'page_list', 'page_search'].includes(tool.name),
      )
      .map((tool) => ({
        name: tool.name,
        readOnlyHint: tool.annotations?.readOnlyHint,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  ).toEqual([
    { name: 'page_get', readOnlyHint: true },
    { name: 'page_list', readOnlyHint: true },
    { name: 'page_search', readOnlyHint: true },
  ])
})

describe('page_get', () => {
  it('rejects invalid input', async () => {
    const result = await callMcpTool(client, 'page_get', {
      taskId: 'not-a-uuid',
      pageId: TEST_UUID,
    })

    expect(result).toEqual({
      isError: true,
      content: [
        {
          type: 'text',
          text: 'Input validation error: Invalid arguments for tool page_get: taskId: Invalid input',
        },
      ],
    })
  })

  it('returns the full page including content', async () => {
    const task = await createTask('Task with notes')
    const created = await createPage(
      task.id,
      'Investigation notes',
      '# Findings\n\nSome long content.',
    )

    const toolResult = await callMcpTool(client, 'page_get', {
      taskId: task.id,
      pageId: created.id,
    })

    expect(normalizeDynamicValues(parseToolJson(toolResult))).toEqual({
      id: '<uuid>',
      taskId: '<uuid>',
      title: 'Investigation notes',
      content: '# Findings\n\nSome long content.',
      format: 'markdown',
      sortOrder: 0,
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
      author: { kind: 'human', agent: null },
    })
  })

  it('maps a non-existent page id to a 404 error result', async () => {
    const task = await createTask('Task')

    const result = await callMcpTool(client, 'page_get', {
      taskId: task.id,
      pageId: TEST_UUID,
    })

    expect(result).toEqual({
      content: [{ type: 'text', text: 'Page not found' }],
      isError: true,
    })
  })
})

describe('page_search', () => {
  it('rejects invalid input', async () => {
    const result = await callMcpTool(client, 'page_search', { q: '   ' })

    expect(result).toEqual({
      isError: true,
      content: [
        {
          type: 'text',
          text: 'Input validation error: Invalid arguments for tool page_search: q: Too small: expected string to have >=1 characters',
        },
      ],
    })
  })

  it('returns page matches with location metadata', async () => {
    const task = await createTask('Task with searchable history')
    await createPage(task.id, 'Investigation log', 'mcp page locator')

    const toolResult = await callMcpTool(client, 'page_search', {
      q: 'mcp page locator',
      limit: 1,
    })

    expect(normalizeDynamicValues(parseToolJson(toolResult))).toEqual({
      results: [
        {
          source: 'page',
          taskNumber: task.number,
          taskTitle: 'Task with searchable history',
          pageId: '<uuid>',
          pageTitle: 'Investigation log',
          snippet: 'mcp page locator',
          matchCount: 3,
          updatedAt: '<timestamp>',
        },
      ],
    })
  })

  it('returns comment matches without page metadata', async () => {
    const task = await createTask('Task with searchable history')
    await createComment(task.id, 'mcp comment locator')

    const toolResult = await callMcpTool(client, 'page_search', {
      q: 'mcp comment locator',
    })

    expect(normalizeDynamicValues(parseToolJson(toolResult))).toEqual({
      results: [
        {
          source: 'comment',
          taskNumber: task.number,
          taskTitle: 'Task with searchable history',
          pageId: null,
          pageTitle: null,
          snippet: 'mcp comment locator',
          matchCount: 3,
          updatedAt: '<timestamp>',
        },
      ],
    })
  })
})

describe('page_list', () => {
  it('returns complete pages for the requested task', async () => {
    const task = await createTask('Sample task')
    await createPage(task.id, 'Sample page', 'Sample page content')

    const toolResult = await callMcpTool(client, 'page_list', {
      taskId: task.id,
    })

    expect(normalizeDynamicValues(parseToolJson(toolResult))).toEqual([
      {
        id: '<uuid>',
        taskId: '<uuid>',
        title: 'Sample page',
        content: 'Sample page content',
        format: 'markdown',
        sortOrder: 0,
        createdAt: '<timestamp>',
        updatedAt: '<timestamp>',
        author: { kind: 'human', agent: null },
      },
    ])
  })
})
