import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { app } from '#app'
import {
  callMcpTool,
  connectMcpClient,
  normalizeDynamicValues,
  parseToolJson,
} from '#routes/mcp/testing'
import { createTask } from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

let client: Client

beforeEach(async () => {
  client = await connectMcpClient()
})

afterEach(async () => {
  await client.close()
})

function callTool(
  name: string,
  args: Record<string, unknown> = {},
): Promise<CallToolResult> {
  return callMcpTool(client, name, args)
}

function summarizeProjectDeletion(
  result: CallToolResult,
  lookupStatus: number,
) {
  return { result: parseToolJson(result), lookupStatus }
}

function summarizeTaskPathTraversal(
  updateIsError: boolean | undefined,
  deleteIsError: boolean | undefined,
  updateTask: { status: number; body: unknown },
  deleteTask: { status: number; body: unknown },
) {
  return { updateIsError, deleteIsError, updateTask, deleteTask }
}

async function createProject(input: {
  title: string
  status?: 'active' | 'paused' | 'completed' | 'archived'
  context?: 'work' | 'personal'
}): Promise<{ id: string }> {
  const response = await app.request('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return jsonBody(response, z.object({ id: z.uuid() }))
}

describe('project operation tools', () => {
  it('derives annotations from each project operation kind', async () => {
    const result = await client.listTools()

    expect(
      result.tools
        .filter((tool) => tool.name.startsWith('project_'))
        .map((tool) => ({ name: tool.name, annotations: tool.annotations }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    ).toEqual([
      {
        name: 'project_create',
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      {
        name: 'project_delete',
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
      { name: 'project_get', annotations: { readOnlyHint: true } },
      { name: 'project_list', annotations: { readOnlyHint: true } },
      { name: 'project_tasks', annotations: { readOnlyHint: true } },
      {
        name: 'project_update',
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
    ])
  })

  it('filters project_list by title, status, and context', async () => {
    await createProject({
      title: 'Work site',
      status: 'active',
      context: 'work',
    })
    await createProject({
      title: 'Personal site',
      status: 'active',
      context: 'personal',
    })
    await createProject({
      title: 'Archived work site',
      status: 'archived',
      context: 'work',
    })

    const result = await callTool('project_list', {
      q: 'site',
      status: 'active',
      context: 'work',
    })

    expect(normalizeDynamicValues(parseToolJson(result))).toEqual([
      {
        id: '<uuid>',
        title: 'Work site',
        description: null,
        status: 'active',
        startDate: null,
        targetDate: null,
        color: null,
        sortOrder: 0,
        context: 'work',
        createdAt: '<timestamp>',
        updatedAt: '<timestamp>',
        completionRate: 0,
        taskCount: { total: 0, completed: 0 },
      },
    ])
  })

  it('returns project_create output as JSON', async () => {
    const result = await callTool('project_create', {
      title: 'Planning space',
      context: 'work',
    })

    expect(normalizeDynamicValues(parseToolJson(result))).toEqual({
      id: '<uuid>',
      title: 'Planning space',
      description: null,
      status: 'active',
      startDate: null,
      targetDate: null,
      color: null,
      sortOrder: 0,
      context: 'work',
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })
  })

  it('returns project_get with task summary fields', async () => {
    const project = await createProject({ title: 'Reference space' })
    const result = await callTool('project_get', { id: project.id })

    expect(normalizeDynamicValues(parseToolJson(result))).toEqual({
      id: '<uuid>',
      title: 'Reference space',
      description: null,
      status: 'active',
      startDate: null,
      targetDate: null,
      color: null,
      sortOrder: 0,
      context: 'personal',
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
      completionRate: 0,
      taskCount: { total: 0, completed: 0 },
    })
  })

  it('returns project_update output as JSON', async () => {
    const project = await createProject({ title: 'Initial space' })
    const result = await callTool('project_update', {
      id: project.id,
      title: 'Revised space',
      status: 'paused',
    })

    expect(normalizeDynamicValues(parseToolJson(result))).toEqual({
      id: '<uuid>',
      title: 'Revised space',
      description: null,
      status: 'paused',
      startDate: null,
      targetDate: null,
      color: null,
      sortOrder: 0,
      context: 'personal',
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })
  })

  it('deletes the project and returns its id', async () => {
    const project = await createProject({ title: 'Temporary space' })
    const result = await callTool('project_delete', { id: project.id })
    const lookup = await app.request(`/api/projects/${project.id}`)

    expect(summarizeProjectDeletion(result, lookup.status)).toEqual({
      result: { deleted: true, id: project.id },
      lookupStatus: 404,
    })
  })

  it('returns only tasks assigned to project_tasks', async () => {
    const project = await createProject({ title: 'Task space' })
    await createTask('Unassigned item')
    const task = await createTask('Assigned item')
    await app.request(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id }),
    })

    const result = await callTool('project_tasks', { id: project.id })

    expect(
      normalizeDynamicValues(parseToolJson(result), { taskNumbers: true }),
    ).toEqual([
      {
        id: '<uuid>',
        number: -1,
        title: 'Assigned item',
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
        projectId: '<uuid>',
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
        childCompletionCount: { completed: 0, total: 0 },
      },
    ])
  })

  it('rejects invalid project path ids for every id-based operation', async () => {
    const invalidIds = ['', '.', '..', '\uD800']
    const toolNames = [
      'project_get',
      'project_update',
      'project_delete',
      'project_tasks',
    ]
    const results = await Promise.all(
      toolNames.map(async (name) => ({
        name,
        errors: await Promise.all(
          invalidIds.map(
            async (id) =>
              (
                await callTool(
                  name,
                  name === 'project_update'
                    ? { id, title: 'Changed title' }
                    : { id },
                )
              ).isError,
          ),
        ),
      })),
    )

    expect(results).toEqual([
      { name: 'project_get', errors: [true, true, true, true] },
      { name: 'project_update', errors: [true, true, true, true] },
      { name: 'project_delete', errors: [true, true, true, true] },
      { name: 'project_tasks', errors: [true, true, true, true] },
    ])
  })

  it('does not allow project update or delete to target tasks through path traversal', async () => {
    const updateTask = await createTask('Protected update item')
    const deleteTask = await createTask('Protected delete item')
    const updateResult = await callTool('project_update', {
      id: `../tasks/${updateTask.id}`,
      title: 'Changed through project tool',
    })
    const deleteResult = await callTool('project_delete', {
      id: `../tasks/${deleteTask.id}`,
    })
    const updateLookup = await app.request(`/api/tasks/${updateTask.id}`)
    const deleteLookup = await app.request(`/api/tasks/${deleteTask.id}`)
    const taskStateSchema = z.union([
      z.object({ title: z.string() }),
      z.object({ error: z.string() }),
    ])

    expect(
      summarizeTaskPathTraversal(
        updateResult.isError,
        deleteResult.isError,
        {
          status: updateLookup.status,
          body: await jsonBody(updateLookup, taskStateSchema),
        },
        {
          status: deleteLookup.status,
          body: await jsonBody(deleteLookup, taskStateSchema),
        },
      ),
    ).toEqual({
      updateIsError: true,
      deleteIsError: true,
      updateTask: {
        status: 200,
        body: { title: 'Protected update item' },
      },
      deleteTask: {
        status: 200,
        body: { title: 'Protected delete item' },
      },
    })
  })
})
