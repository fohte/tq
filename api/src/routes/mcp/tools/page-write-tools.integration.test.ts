import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  callMcpTool,
  connectMcpClient,
  parseToolData,
} from '#routes/mcp/testing'
import { createPage, createTask, TEST_UUID } from '#routes/tasks/testing'
import { setupTestDb } from '#testing'

setupTestDb()

let client: Client

beforeEach(async () => {
  client = await connectMcpClient()
})

afterEach(async () => {
  await client.close()
})

describe('create_page tool', () => {
  it('creates a page with the given fields, attributed to the default mcp agent', async () => {
    const task = await createTask('Has pages')

    const result = await callMcpTool(client, 'create_page', {
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

    const result = await callMcpTool(client, 'create_page', {
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

    const result = await callMcpTool(client, 'create_page', {
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
    const result = await callMcpTool(client, 'create_page', {
      taskId: TEST_UUID,
      title: 'Orphan page',
    })

    expect(result).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'Task not found' }],
    })
  })
})

describe('update_page tool', () => {
  it('partially updates the given fields', async () => {
    const task = await createTask('Has pages')
    const page = await createPage(task.id, 'Original title', 'Original content')

    const result = await callMcpTool(client, 'update_page', {
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

    const result = await callMcpTool(client, 'update_page', {
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

    const result = await callMcpTool(client, 'update_page', {
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

    const result = await callMcpTool(client, 'update_page', {
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
