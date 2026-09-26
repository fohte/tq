import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { app } from '#app'
import { createTask } from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

function normalizeDynamicValues(value: unknown): unknown {
  if (typeof value === 'string') {
    if (UUID_PATTERN.test(value)) return '<uuid>'
    if (TIMESTAMP_PATTERN.test(value)) return '<timestamp>'
    return value
  }
  if (Array.isArray(value)) return value.map(normalizeDynamicValues)
  if (value != null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        normalizeDynamicValues(nested),
      ]),
    )
  }
  return value
}

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ name: 'test-client', version: '1.0.0' })
  const transport = new StreamableHTTPClientTransport(
    new URL('http://localhost/api/mcp'),
    { fetch: async (url, init) => app.request(url, init) },
  )
  // `Transport.sessionId` is `sessionId?: string`, which `exactOptionalPropertyTypes`
  // treats as excluding `undefined`; this class's getter returns `string | undefined`.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- see comment above
  await client.connect(transport as Transport)
  return fn(client).finally(() => client.close())
}

async function callTool(
  name: string,
  args: Record<string, unknown> = {},
): Promise<CallToolResult> {
  const result = await withClient((client) =>
    client.callTool({ name, arguments: args }),
  )
  // The SDK's inferred return type has the same wire shape but does not narrow
  // `content` to the standalone `CallToolResult` type.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- same wire shape
  return result as CallToolResult
}

function parseJson(result: CallToolResult): unknown {
  const first = result.content[0]
  if (first?.type !== 'text') {
    throw new Error(
      `Expected text content, got: ${JSON.stringify(result.content)}`,
    )
  }
  return JSON.parse(first.text)
}

function summarizeProjectDeletion(
  result: CallToolResult,
  lookupStatus: number,
) {
  return { result: parseJson(result), lookupStatus }
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
    const result = await withClient((client) => client.listTools())

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

    expect(normalizeDynamicValues(parseJson(result))).toEqual([
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

    expect(normalizeDynamicValues(parseJson(result))).toEqual({
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

    expect(normalizeDynamicValues(parseJson(result))).toEqual({
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

    expect(normalizeDynamicValues(parseJson(result))).toEqual({
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

    const expectedResponse = await app.request(
      `/api/tasks?projectId=${encodeURIComponent(project.id)}`,
    )
    const expected = await jsonBody<Record<string, unknown>[]>(expectedResponse)
    const result = await callTool('project_tasks', { id: project.id })

    expect(parseJson(result)).toEqual(expected)
  })
})
