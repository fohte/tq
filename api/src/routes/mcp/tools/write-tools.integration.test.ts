import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import {
  type CallToolResult,
  CallToolResultSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import { labels } from '#db/schema'
import {
  createComment,
  createLabel,
  createPage,
  createTask,
  TEST_UUID,
} from '#routes/tasks/testing'
import { jsonBody, passthroughSchema, setupTestDb } from '#testing'

setupTestDb()

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

// `number` is a per-suite-run sequential value (the sequence isn't rolled
// back with the surrounding test transaction), so it's normalized like the
// uuid/timestamp fields rather than asserted on directly. `skipKeys` opts a
// key out of uuid/timestamp normalization for callers that already know its
// real value (e.g. a page/comment response's `taskId`, or an updated
// resource's own `id`) and want to assert on that value directly instead of
// blurring it into a placeholder.
function normalizeDynamicValues(
  value: unknown,
  key: string | undefined,
  skipKeys: ReadonlySet<string>,
): unknown {
  if (key != null && skipKeys.has(key)) return value
  if (key === 'number' && typeof value === 'number') return '<number>'
  if (typeof value === 'string') {
    if (UUID_PATTERN.test(value)) return '<uuid>'
    if (TIMESTAMP_PATTERN.test(value)) return '<timestamp>'
    return value
  }
  if (Array.isArray(value)) {
    return value.map((v) => normalizeDynamicValues(v, undefined, skipKeys))
  }
  if (value != null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        normalizeDynamicValues(v, k, skipKeys),
      ]),
    )
  }
  return value
}

// Raw parse, keeping real ids/timestamps as-is. Use this only to pull a
// value (e.g. a created task's id) needed to drive further calls in the
// test; use `parseToolData` when asserting on the result itself.
function parseToolJson(result: CallToolResult): unknown {
  const [first] = result.content
  if (first?.type !== 'text') throw new Error('expected text content')
  return JSON.parse(first.text)
}

function parseToolData(
  result: CallToolResult,
  skipKeys: readonly string[] = [],
): unknown {
  return normalizeDynamicValues(
    parseToolJson(result),
    undefined,
    new Set(skipKeys),
  )
}

let client: Client

beforeEach(async () => {
  client = new Client({ name: 'test-client', version: '1.0.0' })
  const transport = new StreamableHTTPClientTransport(
    new URL('http://localhost/api/mcp'),
    { fetch: async (url, init) => app.request(url, init) },
  )
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- see index.integration.test.ts
  await client.connect(transport as Transport)
})

afterEach(async () => {
  await client.close()
})

async function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const result = await client.callTool(
    { name, arguments: args },
    CallToolResultSchema,
  )
  // `callTool`'s return type is the same content/toolResult union regardless
  // of which `resultSchema` is passed, so passing `CallToolResultSchema`
  // guarantees the `content` shape at runtime without narrowing the type.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- see comment above
  return result as CallToolResult
}

describe('create_task tool', () => {
  it('creates a task with the given fields', async () => {
    const result = await callTool('create_task', {
      title: 'Write MCP tools',
      context: 'work',
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      number: '<number>',
      title: 'Write MCP tools',
      description: null,
      status: 'todo',
      statusReason: null,
      context: 'work',
      commitment: 'inbox',
      labels: [],
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
      linkSync: { outgoing: [], unresolvedRefs: [] },
    })
  })

  it('creates any label names that do not exist yet and attaches all of them', async () => {
    await db.insert(labels).values({ name: 'urgent' })

    const result = await callTool('create_task', {
      title: 'Labeled task',
      labels: ['urgent', 'new-label'],
    })

    const data = passthroughSchema<{ labels: string[] }>().parse(
      parseToolJson(result),
    )

    expect(data.labels.toSorted()).toEqual(['new-label', 'urgent'])
  })

  it('rejects a non-existent parentId', async () => {
    const result = await callTool('create_task', {
      title: 'Orphan',
      parentId: TEST_UUID,
    })

    expect(result).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'Parent task not found' }],
    })
  })
})

describe('update_task tool', () => {
  it('partially updates the given fields', async () => {
    const task = await createTask('Original title', {
      description: 'Original description',
    })

    const result = await callTool('update_task', {
      taskId: task.id,
      title: 'Updated title',
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      number: '<number>',
      title: 'Updated title',
      description: 'Original description',
      status: 'todo',
      statusReason: null,
      context: 'personal',
      commitment: 'inbox',
      labels: [],
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })
  })

  it('clears a nullable field by passing null', async () => {
    const task = await createTask('Has description', {
      description: 'Will be cleared',
    })

    const result = await callTool('update_task', {
      taskId: task.id,
      description: null,
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      number: '<number>',
      title: 'Has description',
      description: null,
      status: 'todo',
      statusReason: null,
      context: 'personal',
      commitment: 'inbox',
      labels: [],
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
      linkSync: { outgoing: [], unresolvedRefs: [] },
    })
  })

  it('rejects a non-existent taskId', async () => {
    const result = await callTool('update_task', {
      taskId: TEST_UUID,
      title: 'New title',
    })

    expect(result).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'Task not found' }],
    })
  })

  it('replaces the labels of a task, creating any that do not exist yet', async () => {
    const task = await createTask('Has a label', { labels: ['urgent'] })

    const result = await callTool('update_task', {
      taskId: task.id,
      labels: ['bug'],
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      number: '<number>',
      title: 'Has a label',
      description: null,
      status: 'todo',
      statusReason: null,
      context: 'personal',
      commitment: 'inbox',
      labels: ['bug'],
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })
  })
})

describe('update_task_status tool', () => {
  it('sets a task to in_progress', async () => {
    const task = await createTask('Start me')

    const result = await callTool('update_task_status', {
      taskId: task.id,
      status: 'in_progress',
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      number: '<number>',
      title: 'Start me',
      description: null,
      status: 'in_progress',
      statusReason: null,
      context: 'personal',
      commitment: 'inbox',
      labels: [],
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })
  })

  it('keeps the labels of a labeled task', async () => {
    await createLabel('urgent')
    const task = await createTask('Start me', { labels: ['urgent'] })

    const result = await callTool('update_task_status', {
      taskId: task.id,
      status: 'in_progress',
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      number: '<number>',
      title: 'Start me',
      description: null,
      status: 'in_progress',
      statusReason: null,
      context: 'personal',
      commitment: 'inbox',
      labels: ['urgent'],
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })
  })

  it('moves a task back to todo', async () => {
    const task = await createTask('Stop me')
    await callTool('update_task_status', {
      taskId: task.id,
      status: 'in_progress',
    })

    const result = await callTool('update_task_status', {
      taskId: task.id,
      status: 'todo',
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      number: '<number>',
      title: 'Stop me',
      description: null,
      status: 'todo',
      statusReason: null,
      context: 'personal',
      commitment: 'inbox',
      labels: [],
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })
  })

  it('reopens a completed task by moving it back to todo', async () => {
    const task = await createTask('Reopen me')
    await callTool('update_task_status', {
      taskId: task.id,
      status: 'completed',
    })

    const result = await callTool('update_task_status', {
      taskId: task.id,
      status: 'todo',
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      number: '<number>',
      title: 'Reopen me',
      description: null,
      status: 'todo',
      statusReason: null,
      context: 'personal',
      commitment: 'inbox',
      labels: [],
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })
  })

  it('completes a recurring task and generates its next occurrence', async () => {
    const created = await callTool('create_task', {
      title: 'Daily recurring task',
      dueDate: '2026-03-22',
      recurrenceRule: { type: 'daily', interval: 1 },
    })
    const createdData = passthroughSchema<{ id: string }>().parse(
      parseToolJson(created),
    )

    const result = await callTool('update_task_status', {
      taskId: createdData.id,
      status: 'completed',
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      number: '<number>',
      title: 'Daily recurring task',
      description: null,
      status: 'completed',
      statusReason: 'completed',
      context: 'personal',
      commitment: 'inbox',
      labels: [],
      startDate: null,
      dueDate: '2026-03-22',
      estimatedMinutes: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: '<uuid>',
      recurrenceRule: {
        id: '<uuid>',
        type: 'daily',
        interval: 1,
        daysOfWeek: null,
        dayOfMonth: null,
      },
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
      nextTask: {
        id: '<uuid>',
        number: '<number>',
        title: 'Daily recurring task',
        description: null,
        status: 'todo',
        statusReason: null,
        context: 'personal',
        commitment: 'inbox',
        labels: [],
        startDate: null,
        dueDate: '2026-03-23',
        estimatedMinutes: null,
        parentId: null,
        projectId: null,
        recurrenceRuleId: '<uuid>',
        recurrenceRule: {
          id: '<uuid>',
          type: 'daily',
          interval: 1,
          daysOfWeek: null,
          dayOfMonth: null,
        },
        githubLinks: [],
        createdAt: '<timestamp>',
        updatedAt: '<timestamp>',
        linkSync: {
          outgoing: [],
          unresolvedRefs: [],
        },
      },
    })
  })

  it('closes a task as a duplicate and records the target', async () => {
    const target = await createTask('Target')
    const task = await createTask('Duplicate me')

    const result = await callTool('update_task_status', {
      taskId: task.id,
      status: 'completed',
      statusReason: 'duplicate',
      duplicateOfTaskId: target.id,
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      number: '<number>',
      title: 'Duplicate me',
      description: null,
      status: 'completed',
      statusReason: 'duplicate',
      context: 'personal',
      commitment: 'inbox',
      labels: [],
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
      nextTask: null,
    })

    // The tool response itself carries no duplicateOfNumber/duplicateOfTask
    // field (see TaskResponse) — the detail endpoint is the only way to
    // confirm `duplicateOfTaskId` actually reached the request body.
    const detailRes = await app.request(`/api/tasks/${task.id}`)
    const detailBody = await jsonBody<{ duplicateOfNumber: number | null }>(
      detailRes,
    )
    expect(detailBody.duplicateOfNumber).toBe(target.number)
  })
})

describe('create_page tool', () => {
  it('creates a page with the given fields, attributed to the default mcp agent', async () => {
    const task = await createTask('Has pages')

    const result = await callTool('create_page', {
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

    const result = await callTool('create_page', {
      taskId: task.id,
      title: 'My Page',
      agent: 'claude-opus-5',
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
      author: { kind: 'llm', agent: 'claude-opus-5' },
      linkSync: { outgoing: [], unresolvedRefs: [] },
    })
  })

  it('creates a page with format html', async () => {
    const task = await createTask('Has pages')

    const result = await callTool('create_page', {
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
    const result = await callTool('create_page', {
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

    const result = await callTool('update_page', {
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

    const result = await callTool('update_page', {
      taskId: task.id,
      pageId: page.id,
      content: 'Updated content',
      agent: 'claude-opus-5',
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
      author: { kind: 'llm', agent: 'claude-opus-5' },
      linkSync: { outgoing: [], unresolvedRefs: [] },
    })
  })

  it('updates format from markdown to html', async () => {
    const task = await createTask('Has pages')
    const page = await createPage(task.id, 'Original title', 'Original content')

    const result = await callTool('update_page', {
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

    const result = await callTool('update_page', {
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

describe('create_comment tool', () => {
  it('creates a comment, attributed to the default mcp agent', async () => {
    const task = await createTask('Has comments')

    const result = await callTool('create_comment', {
      taskId: task.id,
      content: 'A comment',
    })

    expect(parseToolData(result, ['taskId'])).toEqual({
      id: '<uuid>',
      taskId: task.id,
      content: 'A comment',
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
      author: { kind: 'llm', agent: 'mcp' },
      linkSync: { outgoing: [], unresolvedRefs: [] },
    })
  })

  it('attributes the comment to an explicitly passed agent', async () => {
    const task = await createTask('Has comments')

    const result = await callTool('create_comment', {
      taskId: task.id,
      content: 'A comment',
      agent: 'claude-opus-5',
    })

    expect(parseToolData(result, ['taskId'])).toEqual({
      id: '<uuid>',
      taskId: task.id,
      content: 'A comment',
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
      author: { kind: 'llm', agent: 'claude-opus-5' },
      linkSync: { outgoing: [], unresolvedRefs: [] },
    })
  })

  it('rejects a non-existent taskId', async () => {
    const result = await callTool('create_comment', {
      taskId: TEST_UUID,
      content: 'Orphan comment',
    })

    expect(result).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'Task not found' }],
    })
  })
})

describe('update_comment tool', () => {
  it('updates the comment content', async () => {
    const task = await createTask('Has comments')
    const comment = await createComment(task.id, 'Original content')

    const result = await callTool('update_comment', {
      taskId: task.id,
      commentId: comment.id,
      content: 'Updated content',
    })

    expect(parseToolData(result, ['id', 'taskId'])).toEqual({
      id: comment.id,
      taskId: task.id,
      content: 'Updated content',
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
      author: { kind: 'llm', agent: 'mcp' },
      linkSync: { outgoing: [], unresolvedRefs: [] },
    })
  })

  it('attributes the update to an explicitly passed agent', async () => {
    const task = await createTask('Has comments')
    const comment = await createComment(task.id, 'Original content')

    const result = await callTool('update_comment', {
      taskId: task.id,
      commentId: comment.id,
      content: 'Updated content',
      agent: 'claude-opus-5',
    })

    expect(parseToolData(result, ['id', 'taskId'])).toEqual({
      id: comment.id,
      taskId: task.id,
      content: 'Updated content',
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
      author: { kind: 'llm', agent: 'claude-opus-5' },
      linkSync: { outgoing: [], unresolvedRefs: [] },
    })
  })

  it('rejects a non-existent commentId', async () => {
    const task = await createTask('Has comments')

    const result = await callTool('update_comment', {
      taskId: task.id,
      commentId: TEST_UUID,
      content: 'Updated content',
    })

    expect(result).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'Comment not found' }],
    })
  })
})
