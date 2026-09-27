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

function summarizeDeletion(result: CallToolResult, lookupStatus: number) {
  return {
    result: normalizeDynamicValues(parseToolJson(result)),
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
      result: { deleted: true, id: '<uuid>' },
      lookupStatus: 404,
    })
  })
})
