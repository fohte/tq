import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import { labels, taskGithubLinks } from '#db/schema'
import {
  mockGithubIssueResponse,
  upsertGithubToken,
} from '#integrations/github/testing'
import {
  callMcpTool,
  connectMcpClient,
  normalizeDynamicValues,
  parseToolData,
  parseToolJson,
} from '#routes/mcp/testing'
import { createLabel, createTask, TEST_UUID } from '#routes/tasks/testing'
import { jsonBody, passthroughSchema, setupTestDb } from '#testing'

setupTestDb()

let client: Client

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sortTaskLabels(value: unknown): unknown {
  if (
    !isRecord(value) ||
    !Array.isArray(value['labels']) ||
    !value['labels'].every(
      (label): label is string => typeof label === 'string',
    )
  ) {
    return value
  }
  return { ...value, labels: [...value['labels']].sort() }
}

function summarizeTaskDeletion(
  result: Awaited<ReturnType<typeof callMcpTool>>,
  lookupStatus: number,
) {
  return { result: parseToolJson(result), lookupStatus }
}

beforeEach(async () => {
  client = await connectMcpClient()
})

afterEach(async () => {
  await client.close()
})

describe('task_create tool', () => {
  it('creates a task with the given fields', async () => {
    const result = await callMcpTool(client, 'task_create', {
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
      remindAt: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      templateId: null,
      occurrenceDate: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
      linkSync: { outgoing: [], unresolvedRefs: [] },
    })
  })

  it('creates a GitHub blocker from a URL', async () => {
    const url = 'https://github.com/example-owner/example-repo/issues/17'
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse({ html_url: url, title: 'External blocker' })

    const result = await callMcpTool(client, 'task_create', {
      title: 'Blocked by a GitHub issue',
      blockedBy: [url],
    })
    const taskId = passthroughSchema<{ id: string }>().parse(
      parseToolJson(result),
    ).id
    const blockers = await db
      .select({
        owner: taskGithubLinks.owner,
        repo: taskGithubLinks.repo,
        number: taskGithubLinks.number,
        role: taskGithubLinks.role,
        notifyEvents: taskGithubLinks.notifyEvents,
        title: taskGithubLinks.title,
      })
      .from(taskGithubLinks)
      .where(eq(taskGithubLinks.taskId, taskId))

    const getActual = () => ({ isError: Boolean(result.isError), blockers })
    expect(getActual()).toEqual({
      isError: false,
      blockers: [
        {
          owner: 'example-owner',
          repo: 'example-repo',
          number: 17,
          role: 'blocker',
          notifyEvents: ['closed'],
          title: 'External blocker',
        },
      ],
    })
  })

  it('creates any label names that do not exist yet and attaches all of them', async () => {
    await db.insert(labels).values({ name: 'urgent' })

    const result = await callMcpTool(client, 'task_create', {
      title: 'Labeled task',
      labels: ['urgent', 'new-label'],
    })

    expect(sortTaskLabels(parseToolData(result))).toEqual({
      id: '<uuid>',
      number: '<number>',
      title: 'Labeled task',
      description: null,
      status: 'todo',
      statusReason: null,
      context: 'personal',
      commitment: 'inbox',
      labels: ['new-label', 'urgent'],
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      remindAt: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      templateId: null,
      occurrenceDate: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
      linkSync: { outgoing: [], unresolvedRefs: [] },
    })
  })

  it('rejects a non-existent parentId', async () => {
    const result = await callMcpTool(client, 'task_create', {
      title: 'Orphan',
      parentId: TEST_UUID,
    })

    expect(result).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'Parent task not found' }],
    })
  })
})

describe('task_update tool', () => {
  it('accepts GitHub URLs in blockedBy', async () => {
    const task = await createTask('Blocked by a GitHub issue')
    const url = 'https://github.com/example-owner/example-repo/issues/17'
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse({ html_url: url, title: 'External blocker' })

    const result = await callMcpTool(client, 'task_update', {
      taskId: task.id,
      blockedBy: [url],
    })
    const blockers = await db
      .select({
        owner: taskGithubLinks.owner,
        repo: taskGithubLinks.repo,
        number: taskGithubLinks.number,
        role: taskGithubLinks.role,
        notifyEvents: taskGithubLinks.notifyEvents,
        title: taskGithubLinks.title,
      })
      .from(taskGithubLinks)
      .where(eq(taskGithubLinks.taskId, task.id))

    const getActual = () => ({ isError: Boolean(result.isError), blockers })
    expect(getActual()).toEqual({
      isError: false,
      blockers: [
        {
          owner: 'example-owner',
          repo: 'example-repo',
          number: 17,
          role: 'blocker',
          notifyEvents: ['closed'],
          title: 'External blocker',
        },
      ],
    })
  })

  it('partially updates the given fields', async () => {
    const task = await createTask('Original title', {
      description: 'Original description',
    })

    const result = await callMcpTool(client, 'task_update', {
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
      remindAt: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      templateId: null,
      occurrenceDate: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })
  })

  it('clears a nullable field by passing null', async () => {
    const task = await createTask('Has description', {
      description: 'Will be cleared',
    })

    const result = await callMcpTool(client, 'task_update', {
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
      remindAt: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      templateId: null,
      occurrenceDate: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
      linkSync: { outgoing: [], unresolvedRefs: [] },
    })
  })

  it('rejects a non-existent taskId', async () => {
    const result = await callMcpTool(client, 'task_update', {
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

    const result = await callMcpTool(client, 'task_update', {
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
      remindAt: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      templateId: null,
      occurrenceDate: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })
  })
})

describe('task_complete tool', () => {
  it('sets a task to completed', async () => {
    const task = await createTask('Start me')

    const result = await callMcpTool(client, 'task_complete', {
      taskId: task.id,
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      number: '<number>',
      title: 'Start me',
      description: null,
      status: 'completed',
      statusReason: 'completed',
      context: 'personal',
      commitment: 'inbox',
      labels: [],
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      remindAt: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      templateId: null,
      occurrenceDate: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })
  })

  it('keeps the labels of a labeled task', async () => {
    await createLabel('urgent')
    const task = await createTask('Start me', { labels: ['urgent'] })

    const result = await callMcpTool(client, 'task_complete', {
      taskId: task.id,
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      number: '<number>',
      title: 'Start me',
      description: null,
      status: 'completed',
      statusReason: 'completed',
      context: 'personal',
      commitment: 'inbox',
      labels: ['urgent'],
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      remindAt: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      templateId: null,
      occurrenceDate: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })
  })

  it('closes a task as a duplicate and records the target', async () => {
    const target = await createTask('Target')
    const task = await createTask('Duplicate me')

    const result = await callMcpTool(client, 'task_complete', {
      taskId: task.id,
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
      remindAt: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      templateId: null,
      occurrenceDate: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })

    // The tool response itself carries no duplicateOfNumber/duplicateOfTask
    // field (see TaskResponse) — the detail endpoint is the only way to
    // confirm `duplicateOfTaskId` actually reached the request body.
    const detailRes = await app.request(`/api/tasks/${task.id}`)
    const detailBody = await jsonBody<Record<string, unknown>>(detailRes)
    expect(normalizeDynamicValues(detailBody, { taskNumbers: true })).toEqual({
      id: '<uuid>',
      number: -1,
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
      remindAt: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      templateId: null,
      occurrenceDate: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
      titleAuthor: { kind: 'human', agent: null },
      descriptionAuthor: { kind: 'human', agent: null },
      parentNumber: null,
      childCompletionCount: { total: 0, completed: 0 },
      pages: [],
      timeBlocks: [],
      links: { outgoing: [], incoming: [] },
      duplicateOfNumber: target.number,
      duplicateOfTask: {
        id: '<uuid>',
        number: -1,
        title: 'Target',
        description: null,
        status: 'todo',
        statusReason: null,
        context: 'personal',
        commitment: 'inbox',
        labels: [],
        startDate: null,
        dueDate: null,
        estimatedMinutes: null,
        remindAt: null,
        parentId: null,
        projectId: null,
        recurrenceRuleId: null,
        recurrenceRule: null,
        templateId: null,
        occurrenceDate: null,
        githubLinks: [],
        createdAt: '<timestamp>',
        updatedAt: '<timestamp>',
        parentNumber: null,
        duplicateOfNumber: null,
        blockedByNumbers: [],
        blockedByGithubRefs: [],
        childCompletionCount: { completed: 0, total: 0 },
      },
      githubBlockers: [],
      blockedBy: [],
      blocking: [],
    })
  })
})

describe('task_status tool', () => {
  it('reopens a completed task by moving it back to todo', async () => {
    const task = await createTask('Reopen me')
    await callMcpTool(client, 'task_complete', {
      taskId: task.id,
    })

    const result = await callMcpTool(client, 'task_status', {
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
      remindAt: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      templateId: null,
      occurrenceDate: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })
  })

  it('rejects completed status because completion has its own tool', async () => {
    const task = await createTask('Reopen me')
    const result = await callMcpTool(client, 'task_status', {
      taskId: task.id,
      status: 'completed',
    })
    const detailResponse = await app.request(`/api/tasks/${task.id}`)
    const detail = await jsonBody<{ status: string }>(detailResponse)

    expect(`${String(result.isError)}:${detail.status}`).toBe('true:todo')
  })
})

describe('task_parent tool', () => {
  it('sets the parent task', async () => {
    const parent = await createTask('Parent task')
    const child = await createTask('Child task')

    const result = await callMcpTool(client, 'task_parent', {
      taskId: child.id,
      parentId: parent.id,
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      number: '<number>',
      title: 'Child task',
      description: null,
      status: 'todo',
      statusReason: null,
      context: 'personal',
      commitment: 'inbox',
      labels: [],
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      remindAt: null,
      parentId: '<uuid>',
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      templateId: null,
      occurrenceDate: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })
  })

  it('clears the parent when parentId is omitted', async () => {
    const parent = await createTask('Parent task')
    const child = await createTask('Child task')
    await callMcpTool(client, 'task_parent', {
      taskId: child.id,
      parentId: parent.id,
    })

    const result = await callMcpTool(client, 'task_parent', {
      taskId: child.id,
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      number: '<number>',
      title: 'Child task',
      description: null,
      status: 'todo',
      statusReason: null,
      context: 'personal',
      commitment: 'inbox',
      labels: [],
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      remindAt: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      templateId: null,
      occurrenceDate: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })
  })
})

describe('task_delete tool', () => {
  it('deletes the task and returns its id', async () => {
    const task = await createTask('Delete me')

    const result = await callMcpTool(client, 'task_delete', {
      taskId: task.id,
    })
    const lookup = await app.request(`/api/tasks/${task.id}`)

    expect(summarizeTaskDeletion(result, lookup.status)).toEqual({
      result: { deleted: true, id: task.id },
      lookupStatus: 404,
    })
  })
})
