import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import { labels } from '#db/schema'
import {
  callMcpTool,
  connectMcpClient,
  parseToolData,
  parseToolJson,
} from '#routes/mcp/testing'
import { createLabel, createTask, TEST_UUID } from '#routes/tasks/testing'
import { jsonBody, passthroughSchema, setupTestDb } from '#testing'

setupTestDb()

let client: Client

beforeEach(async () => {
  client = await connectMcpClient()
})

afterEach(async () => {
  await client.close()
})

describe('create_task tool', () => {
  it('creates a task with the given fields', async () => {
    const result = await callMcpTool(client, 'create_task', {
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

  it('creates any label names that do not exist yet and attaches all of them', async () => {
    await db.insert(labels).values({ name: 'urgent' })

    const result = await callMcpTool(client, 'create_task', {
      title: 'Labeled task',
      labels: ['urgent', 'new-label'],
    })

    const data = passthroughSchema<{ labels: string[] }>().parse(
      parseToolJson(result),
    )

    expect(data.labels.toSorted()).toEqual(['new-label', 'urgent'])
  })

  it('rejects a non-existent parentId', async () => {
    const result = await callMcpTool(client, 'create_task', {
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

    const result = await callMcpTool(client, 'update_task', {
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

    const result = await callMcpTool(client, 'update_task', {
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
    const result = await callMcpTool(client, 'update_task', {
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

    const result = await callMcpTool(client, 'update_task', {
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

describe('update_task_status tool', () => {
  it('sets a task to completed', async () => {
    const task = await createTask('Start me')

    const result = await callMcpTool(client, 'update_task_status', {
      taskId: task.id,
      status: 'completed',
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

    const result = await callMcpTool(client, 'update_task_status', {
      taskId: task.id,
      status: 'completed',
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

  it('reopens a completed task by moving it back to todo', async () => {
    const task = await createTask('Reopen me')
    await callMcpTool(client, 'update_task_status', {
      taskId: task.id,
      status: 'completed',
    })

    const result = await callMcpTool(client, 'update_task_status', {
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

  it('closes a task as a duplicate and records the target', async () => {
    const target = await createTask('Target')
    const task = await createTask('Duplicate me')

    const result = await callMcpTool(client, 'update_task_status', {
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
    const detailBody = await jsonBody<{ duplicateOfNumber: number | null }>(
      detailRes,
    )
    expect(detailBody.duplicateOfNumber).toBe(target.number)
  })
})
