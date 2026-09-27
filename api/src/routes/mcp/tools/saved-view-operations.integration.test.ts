import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import {
  type CallToolResult,
  McpError,
} from '@modelcontextprotocol/sdk/types.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { app } from '#app'
import {
  callMcpTool,
  connectMcpClient,
  normalizeDynamicValues,
  parseToolJson,
} from '#routes/mcp/testing'
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

async function seedSavedView(input: {
  name: string
  query: string
  position?: number
  context?: 'work' | 'personal'
}): Promise<{ id: string }> {
  const response = await app.request('/api/saved-views', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return jsonBody(response, z.object({ id: z.uuid() }))
}

async function seedProject(title: string): Promise<{ id: string }> {
  const response = await app.request('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  return jsonBody(response, z.object({ id: z.uuid() }))
}

async function projectState(projectId: string) {
  const response = await app.request(`/api/projects/${projectId}`)
  if (response.status === 200) {
    return {
      status: response.status,
      ...(await jsonBody(response, z.object({ title: z.string() }))),
    }
  }
  return {
    status: response.status,
    ...(await jsonBody(response, z.object({ error: z.string() }))),
  }
}

function summarizeTraversal(
  updateResult: CallToolResult,
  updateProject: Awaited<ReturnType<typeof projectState>>,
  deleteResult: CallToolResult,
  deleteProject: Awaited<ReturnType<typeof projectState>>,
) {
  return { updateResult, updateProject, deleteResult, deleteProject }
}

async function summarizeToolCallOutcome(
  name: string,
  args: Record<string, unknown>,
) {
  try {
    return { kind: 'result' as const, result: await callTool(name, args) }
  } catch (error) {
    return error instanceof McpError
      ? { kind: 'mcp-error' as const, code: error.code }
      : {
          kind: 'unexpected-error' as const,
          message: error instanceof Error ? error.message : String(error),
        }
  }
}

function expectedPathSegmentValidationError(name: string, value: string) {
  const issue =
    value === ''
      ? 'Too small: expected string to have >=1 characters'
      : 'Saved view ID must be a valid path segment'
  return {
    kind: 'result',
    result: {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Input validation error: Invalid arguments for tool ${name}: id: ${issue}`,
        },
      ],
    },
  }
}

function summarizeDeletion(result: CallToolResult, lookupStatus: number) {
  return {
    result: parseToolJson(result),
    lookupStatus,
  }
}

describe('saved view operation tools', () => {
  it('registers saved-view tools with annotations derived from operation kinds', async () => {
    const result = await client.listTools()

    expect(
      result.tools
        .filter((tool) => tool.name.startsWith('saved_view_'))
        .map((tool) => ({ name: tool.name, annotations: tool.annotations }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    ).toEqual([
      {
        name: 'saved_view_create',
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      {
        name: 'saved_view_delete',
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
      { name: 'saved_view_get', annotations: { readOnlyHint: true } },
      { name: 'saved_view_list', annotations: { readOnlyHint: true } },
      {
        name: 'saved_view_update',
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
    ])
  })

  it('filters saved_view_list by name and context', async () => {
    await seedSavedView({
      name: 'Orchid backlog',
      query: 'signal:review',
      context: 'work',
    })
    await seedSavedView({
      name: 'Orchid home',
      query: 'signal:review',
      context: 'personal',
    })
    await seedSavedView({
      name: 'Retired backlog',
      query: 'signal:review',
      context: 'work',
    })

    const result = await callTool('saved_view_list', {
      q: 'ORCHID',
      context: 'work',
    })

    expect(normalizeDynamicValues(parseToolJson(result))).toEqual([
      {
        id: '<uuid>',
        name: 'Orchid backlog',
        query: 'signal:review',
        position: 0,
        context: 'work',
        createdAt: '<timestamp>',
        updatedAt: '<timestamp>',
      },
    ])
  })

  it('creates and returns a saved view', async () => {
    const result = await callTool('saved_view_create', {
      name: 'Orchid schedule',
      query: 'signal:scheduled',
      position: 4,
      context: 'work',
    })

    expect(normalizeDynamicValues(parseToolJson(result))).toEqual({
      id: '<uuid>',
      name: 'Orchid schedule',
      query: 'signal:scheduled',
      position: 4,
      context: 'work',
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })
  })

  it('returns a saved view from saved_view_get', async () => {
    const savedView = await seedSavedView({
      name: 'Orchid archive',
      query: 'signal:archived',
      position: 2,
      context: 'work',
    })

    const result = await callTool('saved_view_get', { id: savedView.id })

    expect(normalizeDynamicValues(parseToolJson(result))).toEqual({
      id: '<uuid>',
      name: 'Orchid archive',
      query: 'signal:archived',
      position: 2,
      context: 'work',
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })
  })

  it('rejects invalid ids for every id-based saved-view tool', async () => {
    const invalidIds = ['', '.', '..', '\uD800']
    const toolNames = [
      'saved_view_get',
      'saved_view_update',
      'saved_view_delete',
    ]
    const outcomes = await Promise.all(
      toolNames.flatMap((name) =>
        invalidIds.map((id) =>
          summarizeToolCallOutcome(
            name,
            name === 'saved_view_update'
              ? { id, name: 'Changed view' }
              : { id },
          ),
        ),
      ),
    )

    expect(outcomes).toEqual(
      toolNames.flatMap((name) =>
        invalidIds.map((id) => expectedPathSegmentValidationError(name, id)),
      ),
    )
  })

  it('updates only the fields passed to saved_view_update', async () => {
    const savedView = await seedSavedView({
      name: 'Orchid draft',
      query: 'signal:draft',
      position: 6,
      context: 'work',
    })

    const result = await callTool('saved_view_update', {
      id: savedView.id,
      name: 'Orchid portfolio',
    })

    expect(normalizeDynamicValues(parseToolJson(result))).toEqual({
      id: '<uuid>',
      name: 'Orchid portfolio',
      query: 'signal:draft',
      position: 6,
      context: 'work',
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })
  })

  it('deletes a saved view and returns its id', async () => {
    const savedView = await seedSavedView({
      name: 'Orchid temporary',
      query: 'signal:temporary',
    })
    const result = await callTool('saved_view_delete', { id: savedView.id })
    const lookup = await app.request(`/api/saved-views/${savedView.id}`)

    expect(summarizeDeletion(result, lookup.status)).toEqual({
      result: { deleted: true, id: savedView.id },
      lookupStatus: 404,
    })
  })

  it('does not route traversal ids to project update or deletion', async () => {
    const updateProject = await seedProject('Original update project')
    const deleteProject = await seedProject('Original deletion project')
    const updateResult = await callTool('saved_view_update', {
      id: `../projects/${updateProject.id}`,
      name: 'Changed project',
    })
    const deleteResult = await callTool('saved_view_delete', {
      id: `../projects/${deleteProject.id}`,
    })

    const [updateProjectState, deleteProjectState] = await Promise.all([
      projectState(updateProject.id),
      projectState(deleteProject.id),
    ])

    expect(
      summarizeTraversal(
        updateResult,
        updateProjectState,
        deleteResult,
        deleteProjectState,
      ),
    ).toEqual({
      updateResult: {
        isError: true,
        content: [{ type: 'text', text: 'Saved view not found' }],
      },
      updateProject: { status: 200, title: 'Original update project' },
      deleteResult: {
        isError: true,
        content: [{ type: 'text', text: 'Saved view not found' }],
      },
      deleteProject: { status: 200, title: 'Original deletion project' },
    })
  })
})
