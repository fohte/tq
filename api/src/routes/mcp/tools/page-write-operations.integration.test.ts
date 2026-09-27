import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  callMcpTool,
  connectMcpClient,
  parseToolData,
  parseToolJson,
} from '#routes/mcp/testing'
import { createPage, createTask, TEST_UUID } from '#routes/tasks/testing'
import { setupTestDb } from '#testing'

setupTestDb()

function summarizePageDeletion(deletion: unknown, remaining: unknown) {
  return { deletion, remaining }
}

let client: Client

beforeEach(async () => {
  client = await connectMcpClient()
})

afterEach(async () => {
  await client.close()
})

it('marks page writes and deletes with their operation annotations', async () => {
  const result = await client.listTools()

  expect(
    result.tools
      .filter((tool) =>
        ['page_create', 'page_delete', 'page_update'].includes(tool.name),
      )
      .map((tool) => ({
        name: tool.name,
        readOnlyHint: tool.annotations?.readOnlyHint,
        destructiveHint: tool.annotations?.destructiveHint,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  ).toEqual([
    {
      name: 'page_create',
      readOnlyHint: false,
      destructiveHint: false,
    },
    {
      name: 'page_delete',
      readOnlyHint: false,
      destructiveHint: true,
    },
    {
      name: 'page_update',
      readOnlyHint: false,
      destructiveHint: false,
    },
  ])
})

describe('page_create', () => {
  it('creates a page with the given fields, attributed to the default mcp agent', async () => {
    const task = await createTask('Has pages')

    const result = await callMcpTool(client, 'page_create', {
      taskId: task.id,
      title: 'My Page',
      content: 'Hello',
    })

    expect(parseToolData(result, ['taskId'])).toEqual({
      id: '<uuid>',
      taskId: task.id,
      title: 'My Page',
      content: 'Hello',
      format: 'markdown',
      sortOrder: 0,
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
      author: { kind: 'llm', agent: 'mcp' },
      linkSync: { outgoing: [], unresolvedRefs: [] },
    })
  })

  it('attributes the page to an explicitly passed agent', async () => {
    const task = await createTask('Has pages')

    const result = await callMcpTool(client, 'page_create', {
      taskId: task.id,
      title: 'My Page',
      agent: 'test-agent',
    })

    expect(parseToolData(result, ['taskId'])).toEqual({
      id: '<uuid>',
      taskId: task.id,
      title: 'My Page',
      content: '',
      format: 'markdown',
      sortOrder: 0,
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
      author: { kind: 'llm', agent: 'test-agent' },
      linkSync: { outgoing: [], unresolvedRefs: [] },
    })
  })

  it('creates a page with format html', async () => {
    const task = await createTask('Has pages')

    const result = await callMcpTool(client, 'page_create', {
      taskId: task.id,
      title: 'HTML Page',
      content: '<p>Hello</p>',
      format: 'html',
    })

    expect(parseToolData(result, ['taskId'])).toEqual({
      id: '<uuid>',
      taskId: task.id,
      title: 'HTML Page',
      content: '<p>Hello</p>',
      format: 'html',
      sortOrder: 0,
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
      author: { kind: 'llm', agent: 'mcp' },
      linkSync: { outgoing: [], unresolvedRefs: [] },
    })
  })

  it('rejects a non-existent taskId', async () => {
    const result = await callMcpTool(client, 'page_create', {
      taskId: TEST_UUID,
      title: 'Orphan page',
    })

    expect(result).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'Task not found' }],
    })
  })
})

describe('page_update', () => {
  it('partially updates the given fields', async () => {
    const task = await createTask('Has pages')
    const page = await createPage(task.id, 'Original title', 'Original content')

    const result = await callMcpTool(client, 'page_update', {
      taskId: task.id,
      pageId: page.id,
      title: 'Updated title',
    })

    expect(parseToolData(result, ['id', 'taskId'])).toEqual({
      id: page.id,
      taskId: task.id,
      title: 'Updated title',
      content: 'Original content',
      format: 'markdown',
      sortOrder: 0,
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
      author: { kind: 'llm', agent: 'mcp' },
    })
  })

  it('attributes the update to an explicitly passed agent', async () => {
    const task = await createTask('Has pages')
    const page = await createPage(task.id, 'Original title', 'Original content')

    const result = await callMcpTool(client, 'page_update', {
      taskId: task.id,
      pageId: page.id,
      content: 'Updated content',
      agent: 'test-agent',
    })

    expect(parseToolData(result, ['id', 'taskId'])).toEqual({
      id: page.id,
      taskId: task.id,
      title: 'Original title',
      content: 'Updated content',
      format: 'markdown',
      sortOrder: 0,
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
      author: { kind: 'llm', agent: 'test-agent' },
      linkSync: { outgoing: [], unresolvedRefs: [] },
    })
  })

  it('updates format from markdown to html', async () => {
    const task = await createTask('Has pages')
    const page = await createPage(task.id, 'Original title', 'Original content')

    const result = await callMcpTool(client, 'page_update', {
      taskId: task.id,
      pageId: page.id,
      format: 'html',
    })

    // `author` reflects the page's last recorded edit, not this call: a
    // format-only change isn't tracked by `diffFields` (title/content only),
    // so no new edit is recorded and the author stays whoever created the
    // page — the `createPage` helper's default `human` author, not the mcp
    // tool's own `llm:mcp`.
    expect(parseToolData(result, ['id', 'taskId'])).toEqual({
      id: page.id,
      taskId: task.id,
      title: 'Original title',
      content: 'Original content',
      format: 'html',
      sortOrder: 0,
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
      author: { kind: 'human', agent: null },
    })
  })

  it('rejects a non-existent pageId', async () => {
    const task = await createTask('Has pages')

    const result = await callMcpTool(client, 'page_update', {
      taskId: task.id,
      pageId: TEST_UUID,
      title: 'Updated title',
    })

    expect(result).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'Page not found' }],
    })
  })
})

describe('page_delete', () => {
  it('returns not found for a non-existent page id', async () => {
    const task = await createTask('Has pages')

    const result = await callMcpTool(client, 'page_delete', {
      taskId: task.id,
      pageId: TEST_UUID,
    })

    expect(result).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'Page not found' }],
    })
  })

  it('deletes a page and returns its identity', async () => {
    const task = await createTask('Sample task')
    const page = await createPage(task.id, 'Sample page', 'Sample content')

    const result = await callMcpTool(client, 'page_delete', {
      taskId: task.id,
      pageId: page.id,
    })
    const remainingPages = await callMcpTool(client, 'page_list', {
      taskId: task.id,
    })

    expect(
      summarizePageDeletion(
        parseToolData(result, ['taskId', 'pageId']),
        parseToolJson(remainingPages),
      ),
    ).toEqual({
      deletion: { deleted: true, taskId: task.id, pageId: page.id },
      remaining: [],
    })
  })
})
