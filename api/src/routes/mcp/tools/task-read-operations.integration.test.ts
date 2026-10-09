import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { app } from '#app'
import {
  callMcpTool,
  connectMcpClient,
  normalizeDynamicValues,
  parseToolData,
  parseToolJson,
} from '#routes/mcp/testing'
import {
  createPage,
  createTask,
  TEST_UUID,
  withoutLinkSync,
} from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

let client: Client
type CreatedTaskResponse = Awaited<ReturnType<typeof createTask>>

function callTaskReadTool(
  name: 'task_list' | 'task_search',
  args: Record<string, unknown> = {},
) {
  return callMcpTool(client, name, { tzOffset: 0, ...args })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeActivities(value: unknown): unknown {
  if (!Array.isArray(value)) return value
  return value.map((activity: unknown) =>
    isRecord(activity)
      ? { ...activity, id: '<activity-id>', createdAt: '<timestamp>' }
      : activity,
  )
}

async function completeTask(
  task: CreatedTaskResponse,
): Promise<CreatedTaskResponse> {
  const response = await app.request(`/api/tasks/${task.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'completed' }),
  })
  return jsonBody<CreatedTaskResponse>(response)
}

function expectedTaskListItem(task: CreatedTaskResponse) {
  return {
    ...withoutLinkSync(task),
    parentNumber: null,
    duplicateOfNumber: null,
    blockedByNumbers: [],
    blockedByGithubRefs: [],
    childCompletionCount: { total: 0, completed: 0 },
    checklistCompletionCount: { total: 0, completed: 0 },
  }
}

function withoutDescription(task: CreatedTaskResponse) {
  const { description, ...taskWithoutDescription } = withoutLinkSync(task)
  void description
  return taskWithoutDescription
}

function expectedTaskListRowItem(task: CreatedTaskResponse) {
  return {
    ...withoutDescription(task),
    parentNumber: null,
    duplicateOfNumber: null,
    blockedByNumbers: [],
    blockedByGithubRefs: [],
    childCompletionCount: { total: 0, completed: 0 },
    checklistCompletionCount: { total: 0, completed: 0 },
  }
}

beforeEach(async () => {
  client = await connectMcpClient()
})

afterEach(async () => {
  await client.close()
})

it('declares task read tools as read-only', async () => {
  const result = await client.listTools()

  expect(
    result.tools
      .filter((tool) =>
        [
          'task_activity',
          'task_get',
          'task_list',
          'task_search',
          'task_sessions',
        ].includes(tool.name),
      )
      .map((tool) => ({
        name: tool.name,
        readOnlyHint: tool.annotations?.readOnlyHint,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  ).toEqual([
    { name: 'task_activity', readOnlyHint: true },
    { name: 'task_get', readOnlyHint: true },
    { name: 'task_list', readOnlyHint: true },
    { name: 'task_search', readOnlyHint: true },
    { name: 'task_sessions', readOnlyHint: true },
  ])
})

it('exposes date filters without candidatesOn in task list and search tools', async () => {
  const result = await client.listTools()
  const dateFilters = ['dateFrom', 'dateTo', 'dueTo', 'candidatesOn']

  expect(
    result.tools
      .filter((tool) => ['task_list', 'task_search'].includes(tool.name))
      .map((tool) => ({
        name: tool.name,
        dateFilters: Object.keys(tool.inputSchema.properties ?? {}).filter(
          (field) => dateFilters.includes(field),
        ),
      }))
      .toSorted((left, right) => left.name.localeCompare(right.name)),
  ).toEqual([
    { name: 'task_list', dateFilters: ['dateFrom', 'dateTo', 'dueTo'] },
    { name: 'task_search', dateFilters: ['dateFrom', 'dateTo', 'dueTo'] },
  ])
})

describe('task_list', () => {
  it('defaults to all contexts and todo status when context and status are omitted', async () => {
    const workTodo = await createTask('Work todo', { context: 'work' })
    const personalTodo = await createTask('Personal todo', {
      context: 'personal',
    })
    await completeTask(await createTask('Work completed', { context: 'work' }))
    await completeTask(
      await createTask('Personal completed', { context: 'personal' }),
    )

    const toolResult = await callTaskReadTool('task_list', {
      sortBy: 'created',
    })

    expect(parseToolJson(toolResult)).toEqual([
      expectedTaskListRowItem(workTodo),
      expectedTaskListRowItem(personalTodo),
    ])
  })

  it('includes descriptions when full is true', async () => {
    const task = await createTask('Task with a description', {
      description: 'Task body',
    })

    const toolResult = await callTaskReadTool('task_list', { full: true })

    expect(parseToolJson(toolResult)).toEqual([expectedTaskListItem(task)])
  })

  it('rejects invalid input', async () => {
    const result = await callTaskReadTool('task_list', {
      projectId: 'not-a-uuid',
    })

    expect(result.isError).toBe(true)
  })

  it('returns tasks matching the given filters', async () => {
    const task = await createTask('Work task', { context: 'work' })
    await createTask('Personal task')

    const toolResult = await callTaskReadTool('task_list', {
      context: 'work',
    })

    expect(parseToolJson(toolResult)).toEqual([
      {
        ...withoutDescription(task),
        parentNumber: null,
        duplicateOfNumber: null,
        blockedByNumbers: [],
        blockedByGithubRefs: [],
        labels: [],
        childCompletionCount: { total: 0, completed: 0 },
        checklistCompletionCount: { total: 0, completed: 0 },
      },
    ])
  })

  it('returns checklist progress in task list rows', async () => {
    const task = await createTask('Checklist task')
    const checklistResponse = await app.request(
      `/api/tasks/${task.id}/checklists`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Review' }),
      },
    )
    const checklist = await jsonBody<{ id: string }>(checklistResponse)
    const completedItemResponse = await app.request(
      `/api/checklists/${checklist.id}/items`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Complete item' }),
      },
    )
    const completedItem = await jsonBody<{ id: string }>(completedItemResponse)
    await app.request(`/api/checklists/${checklist.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Pending item' }),
    })
    await app.request(`/api/checklist-items/${completedItem.id}/check`, {
      method: 'POST',
    })

    const toolResult = await callTaskReadTool('task_list', {})

    expect(parseToolJson(toolResult)).toEqual([
      {
        ...withoutDescription(task),
        parentNumber: null,
        duplicateOfNumber: null,
        blockedByNumbers: [],
        blockedByGithubRefs: [],
        labels: [],
        childCompletionCount: { total: 0, completed: 0 },
        checklistCompletionCount: { total: 2, completed: 1 },
      },
    ])
  })

  it('returns only root tasks when parentId is "root"', async () => {
    const parent = await createTask('Parent')
    await createTask('Child', { parentId: parent.id })

    const toolResult = await callTaskReadTool('task_list', {
      parentId: 'root',
    })

    expect(parseToolJson(toolResult)).toEqual([
      {
        ...withoutDescription(parent),
        parentNumber: null,
        duplicateOfNumber: null,
        blockedByNumbers: [],
        blockedByGithubRefs: [],
        labels: [],
        childCompletionCount: { total: 1, completed: 0 },
        checklistCompletionCount: { total: 0, completed: 0 },
      },
    ])
  })

  it('accepts a task number for parentId', async () => {
    const parent = await createTask('Parent')
    const child = await createTask('Child', { parentId: parent.id })

    const toolResult = await callTaskReadTool('task_list', {
      parentId: parent.number,
    })

    expect(parseToolJson(toolResult)).toEqual([
      {
        ...withoutDescription(child),
        parentNumber: parent.number,
        duplicateOfNumber: null,
        blockedByNumbers: [],
        blockedByGithubRefs: [],
        childCompletionCount: { total: 0, completed: 0 },
        checklistCompletionCount: { total: 0, completed: 0 },
      },
    ])
  })

  it('accepts a task number for descendantOf', async () => {
    const root = await createTask('Root')
    const child = await createTask('Child', { parentId: root.id })
    const grandchild = await createTask('Grandchild', { parentId: child.id })
    await createTask('Unrelated')

    const toolResult = await callTaskReadTool('task_list', {
      descendantOf: root.number,
    })

    expect(parseToolJson(toolResult)).toEqual([
      {
        ...withoutDescription(child),
        parentNumber: root.number,
        duplicateOfNumber: null,
        blockedByNumbers: [],
        blockedByGithubRefs: [],
        childCompletionCount: { total: 1, completed: 0 },
        checklistCompletionCount: { total: 0, completed: 0 },
      },
      {
        ...withoutDescription(grandchild),
        parentNumber: child.number,
        duplicateOfNumber: null,
        blockedByNumbers: [],
        blockedByGithubRefs: [],
        childCompletionCount: { total: 0, completed: 0 },
        checklistCompletionCount: { total: 0, completed: 0 },
      },
    ])
  })

  it('filters by mixed task ids and includes their ancestors', async () => {
    const root = await createTask('Root')
    const selectedByNumber = await createTask('Selected by number', {
      parentId: root.id,
    })
    const selectedById = await createTask('Selected by id', {
      parentId: root.id,
    })
    await createTask('Unselected')

    const toolResult = await callTaskReadTool('task_list', {
      ids: [String(selectedByNumber.number), selectedById.id],
      includeAncestors: true,
    })

    expect(parseToolJson(toolResult)).toEqual([
      {
        ...withoutDescription(selectedByNumber),
        parentNumber: root.number,
        duplicateOfNumber: null,
        blockedByNumbers: [],
        blockedByGithubRefs: [],
        labels: [],
        childCompletionCount: { total: 0, completed: 0 },
        checklistCompletionCount: { total: 0, completed: 0 },
      },
      {
        ...withoutDescription(selectedById),
        parentNumber: root.number,
        duplicateOfNumber: null,
        blockedByNumbers: [],
        blockedByGithubRefs: [],
        labels: [],
        childCompletionCount: { total: 0, completed: 0 },
        checklistCompletionCount: { total: 0, completed: 0 },
      },
      {
        ...withoutDescription(root),
        parentNumber: null,
        duplicateOfNumber: null,
        blockedByNumbers: [],
        blockedByGithubRefs: [],
        labels: [],
        childCompletionCount: { total: 2, completed: 0 },
        checklistCompletionCount: { total: 0, completed: 0 },
        ancestorOnly: true,
      },
    ])
  })
})

describe('task_get', () => {
  it('rejects invalid input', async () => {
    const result = await callMcpTool(client, 'task_get', {
      taskId: 'not-a-uuid',
    })

    expect(result.isError).toBe(true)
  })

  it('merges the task detail with its subtask tree', async () => {
    const parent = await createTask('Parent')
    const child = await createTask('Child', { parentId: parent.id })

    const toolResult = await callMcpTool(client, 'task_get', {
      taskId: parent.number,
    })

    expect(parseToolJson(toolResult)).toEqual({
      ...withoutLinkSync(parent),
      titleAuthor: { kind: 'human', agent: null },
      descriptionAuthor: { kind: 'human', agent: null },
      childCompletionCount: { total: 1, completed: 0 },
      checklistCompletionCount: { total: 0, completed: 0 },
      checklists: [],
      pages: [],
      timeBlocks: [],
      links: { outgoing: [], incoming: [] },
      labels: [],
      parentNumber: null,
      parentTitle: null,
      duplicateOfNumber: null,
      duplicateOfTask: null,
      githubBlockers: [],
      blockedBy: [],
      blocking: [],
      subtasks: [
        {
          ...withoutLinkSync(child),
          parentNumber: parent.number,
          duplicateOfNumber: null,
          blockedByNumbers: [],
          blockedByGithubRefs: [],
          children: [],
          childCompletionCount: { total: 0, completed: 0 },
          checklistCompletionCount: { total: 0, completed: 0 },
        },
      ],
    })
  })

  it('maps a non-existent task id to a 404 error result', async () => {
    const result = await callMcpTool(client, 'task_get', { taskId: TEST_UUID })

    expect(result).toEqual({
      content: [{ type: 'text', text: 'Task not found' }],
      isError: true,
    })
  })

  it('returns page metadata without content', async () => {
    const task = await createTask('Task with notes')
    await createPage(task.id, 'Investigation notes', 'note body')

    const toolResult = await callMcpTool(client, 'task_get', {
      taskId: task.id,
    })

    expect(parseToolData(toolResult)).toEqual(
      normalizeDynamicValues(
        {
          ...withoutLinkSync(task),
          titleAuthor: { kind: 'human', agent: null },
          descriptionAuthor: { kind: 'human', agent: null },
          childCompletionCount: { total: 0, completed: 0 },
          checklistCompletionCount: { total: 0, completed: 0 },
          checklists: [],
          pages: [
            {
              id: '<uuid>',
              taskId: '<uuid>',
              title: 'Investigation notes',
              format: 'markdown',
              sortOrder: 0,
              createdAt: '<timestamp>',
              updatedAt: '<timestamp>',
              author: { kind: 'human', agent: null },
            },
          ],
          timeBlocks: [],
          links: { outgoing: [], incoming: [] },
          labels: [],
          parentNumber: null,
          parentTitle: null,
          duplicateOfNumber: null,
          duplicateOfTask: null,
          githubBlockers: [],
          blockedBy: [],
          blocking: [],
          subtasks: [],
        },
        { numberPlaceholder: true },
      ),
    )
  })
})

describe('task_search', () => {
  it('defaults to all contexts and statuses when context and status are omitted', async () => {
    const workTodo = await createTask('Work todo', { context: 'work' })
    const personalTodo = await createTask('Personal todo', {
      context: 'personal',
    })
    const workCompleted = await completeTask(
      await createTask('Work completed', { context: 'work' }),
    )
    const personalCompleted = await completeTask(
      await createTask('Personal completed', { context: 'personal' }),
    )

    const toolResult = await callTaskReadTool('task_search', {
      sortBy: 'created',
    })

    expect(parseToolJson(toolResult)).toEqual([
      expectedTaskListItem(workTodo),
      expectedTaskListItem(personalTodo),
      expectedTaskListItem(workCompleted),
      expectedTaskListItem(personalCompleted),
    ])
  })

  it('rejects invalid input', async () => {
    const result = await callTaskReadTool('task_search', { limit: 0 })

    expect(result.isError).toBe(true)
  })

  it('returns tasks matching the free-text query', async () => {
    const match = await createTask('Deploy to production')
    await createTask('Buy groceries')

    const toolResult = await callTaskReadTool('task_search', {
      q: 'deploy',
    })

    expect(parseToolJson(toolResult)).toEqual([
      {
        ...withoutLinkSync(match),
        parentNumber: null,
        duplicateOfNumber: null,
        blockedByNumbers: [],
        blockedByGithubRefs: [],
        childCompletionCount: { total: 0, completed: 0 },
        checklistCompletionCount: { total: 0, completed: 0 },
      },
    ])
  })

  it('accepts a task number in the parent: query filter', async () => {
    const parent = await createTask('Parent')
    const child = await createTask('Child', { parentId: parent.id })
    await createTask('Orphan')

    const toolResult = await callTaskReadTool('task_search', {
      q: `parent:${String(parent.number)}`,
    })

    expect(parseToolJson(toolResult)).toEqual([
      {
        ...withoutLinkSync(child),
        parentNumber: parent.number,
        duplicateOfNumber: null,
        blockedByNumbers: [],
        blockedByGithubRefs: [],
        childCompletionCount: { total: 0, completed: 0 },
        checklistCompletionCount: { total: 0, completed: 0 },
      },
    ])
  })

  it('accepts a task number for parentId', async () => {
    const parent = await createTask('Parent')
    const child = await createTask('Child', { parentId: parent.id })
    await createTask('Orphan')

    const toolResult = await callTaskReadTool('task_search', {
      parentId: parent.number,
    })

    expect(parseToolJson(toolResult)).toEqual([
      {
        ...withoutLinkSync(child),
        parentNumber: parent.number,
        duplicateOfNumber: null,
        blockedByNumbers: [],
        blockedByGithubRefs: [],
        childCompletionCount: { total: 0, completed: 0 },
        checklistCompletionCount: { total: 0, completed: 0 },
      },
    ])
  })

  it('accepts a task number for descendantOf', async () => {
    const root = await createTask('Root')
    const child = await createTask('Child', { parentId: root.id })
    const grandchild = await createTask('Grandchild', { parentId: child.id })

    const toolResult = await callTaskReadTool('task_search', {
      q: 'Grandchild',
      descendantOf: root.number,
    })

    expect(parseToolJson(toolResult)).toEqual([
      {
        ...withoutLinkSync(grandchild),
        parentNumber: child.number,
        duplicateOfNumber: null,
        blockedByNumbers: [],
        blockedByGithubRefs: [],
        childCompletionCount: { total: 0, completed: 0 },
        checklistCompletionCount: { total: 0, completed: 0 },
      },
    ])
  })

  it('includes ancestors of tasks filtered by id', async () => {
    const root = await createTask('Parent')
    const match = await createTask('Selected task', { parentId: root.id })
    await createTask('Unselected task')

    const toolResult = await callTaskReadTool('task_search', {
      q: 'Selected',
      ids: [match.id],
      includeAncestors: true,
    })

    expect(parseToolJson(toolResult)).toEqual([
      {
        ...withoutLinkSync(match),
        parentNumber: root.number,
        duplicateOfNumber: null,
        blockedByNumbers: [],
        blockedByGithubRefs: [],
        childCompletionCount: { total: 0, completed: 0 },
        checklistCompletionCount: { total: 0, completed: 0 },
      },
      {
        ...withoutLinkSync(root),
        parentNumber: null,
        duplicateOfNumber: null,
        blockedByNumbers: [],
        blockedByGithubRefs: [],
        labels: [],
        childCompletionCount: { total: 1, completed: 0 },
        checklistCompletionCount: { total: 0, completed: 0 },
        ancestorOnly: true,
      },
    ])
  })

  it('translates hasDue into the REST string param', async () => {
    const withDue = await createTask('With due date', {
      dueDate: '2026-02-01',
    })
    await createTask('Without due date')

    const toolResult = await callTaskReadTool('task_search', {
      hasDue: true,
    })

    expect(parseToolJson(toolResult)).toEqual([
      {
        ...withoutLinkSync(withDue),
        parentNumber: null,
        duplicateOfNumber: null,
        blockedByNumbers: [],
        blockedByGithubRefs: [],
        childCompletionCount: { total: 0, completed: 0 },
        checklistCompletionCount: { total: 0, completed: 0 },
      },
    ])
  })
})

describe('task_activity', () => {
  it('returns the task activity response', async () => {
    const task = await createTask('Activity task')
    const toolResult = await callMcpTool(client, 'task_activity', {
      taskId: task.number,
    })

    expect(normalizeActivities(parseToolJson(toolResult))).toEqual([
      {
        id: '<activity-id>',
        type: 'created',
        createdAt: '<timestamp>',
        author: { kind: 'human', agent: null },
      },
    ])
  })
})

describe('task_sessions', () => {
  it('returns the sessions linked to the task', async () => {
    const task = await createTask('Session task')
    const sessionResponse = await app.request('/api/agent-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'codex',
        sessionId: 'session-example',
        cwd: '/tmp/task-read',
        label: null,
        lastMessage: null,
      }),
    })
    const session = await jsonBody<{ id: string }>(sessionResponse)
    await app.request(`/api/tasks/${task.id}/agent-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentSessionId: session.id }),
    })
    const toolResult = await callMcpTool(client, 'task_sessions', {
      taskId: task.id,
    })

    expect(parseToolData(toolResult)).toEqual([
      {
        id: '<uuid>',
        provider: 'codex',
        sessionId: 'session-example',
        parentSessionId: null,
        context: 'personal',
        cwd: '/tmp/task-read',
        label: null,
        lastMessage: null,
        customLabel: null,
        startedAt: '<timestamp>',
        lastActiveAt: '<timestamp>',
        endedAt: null,
        archivedAt: null,
      },
    ])
  })
})
