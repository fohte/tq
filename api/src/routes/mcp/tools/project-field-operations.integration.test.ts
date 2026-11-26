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
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  return callMcpTool(client, name, args)
}

function projectFieldMcpSnapshot<Value>(value: Value): Value {
  return value
}

describe('project field operation tools', () => {
  it('creates, updates, and deletes fields and options through MCP', async () => {
    const projectResponse = await app.request('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Example Workspace' }),
    })
    const project = await jsonBody(
      projectResponse,
      z.object({ id: z.string() }),
    )
    const createdResult = await callTool('project_field_create', {
      projectId: project.id,
      name: 'Orbit Class',
      options: ['Amber'],
    })
    const created = parseToolJson(createdResult)
    const fieldId = z.object({ id: z.uuid() }).parse(created).id
    const optionResult = await callTool('project_field_option_create', {
      projectId: project.id,
      fieldId,
      name: 'Cobalt',
    })
    const optionId = z
      .object({ id: z.uuid() })
      .parse(parseToolJson(optionResult)).id
    const fieldUpdateResult = await callTool('project_field_update', {
      projectId: project.id,
      fieldId,
      name: 'Orbit Group',
    })
    const optionUpdateResult = await callTool('project_field_option_update', {
      projectId: project.id,
      fieldId,
      optionId,
      name: 'Jade',
    })
    const listResult = await callTool('project_field_list', {
      projectId: project.id,
    })
    const optionDeleteResult = await callTool('project_field_option_delete', {
      projectId: project.id,
      fieldId,
      optionId,
    })
    const listAfterOptionDeleteResult = await callTool('project_field_list', {
      projectId: project.id,
    })
    const fieldDeleteResult = await callTool('project_field_delete', {
      projectId: project.id,
      fieldId,
    })
    const listAfterFieldDeleteResult = await callTool('project_field_list', {
      projectId: project.id,
    })

    expect(
      projectFieldMcpSnapshot({
        created: normalizeDynamicValues(created),
        option: normalizeDynamicValues(parseToolJson(optionResult)),
        field: normalizeDynamicValues(parseToolJson(fieldUpdateResult)),
        renamedOption: normalizeDynamicValues(
          parseToolJson(optionUpdateResult),
        ),
        list: normalizeDynamicValues(parseToolJson(listResult)),
        optionDeleteIsError: optionDeleteResult.isError ?? false,
        listAfterOptionDelete: normalizeDynamicValues(
          parseToolJson(listAfterOptionDeleteResult),
        ),
        fieldDeleteIsError: fieldDeleteResult.isError ?? false,
        listAfterFieldDelete: normalizeDynamicValues(
          parseToolJson(listAfterFieldDeleteResult),
        ),
      }),
    ).toEqual({
      created: {
        id: '<uuid>',
        projectId: '<uuid>',
        name: 'Orbit Class',
        type: 'single_select',
        options: [{ id: '<uuid>', name: 'Amber' }],
        createdAt: '<timestamp>',
        updatedAt: '<timestamp>',
      },
      option: { id: '<uuid>', name: 'Cobalt' },
      field: {
        id: '<uuid>',
        projectId: '<uuid>',
        name: 'Orbit Group',
        type: 'single_select',
        options: [
          { id: '<uuid>', name: 'Amber' },
          { id: '<uuid>', name: 'Cobalt' },
        ],
        createdAt: '<timestamp>',
        updatedAt: '<timestamp>',
      },
      renamedOption: { id: '<uuid>', name: 'Jade' },
      list: [
        {
          id: '<uuid>',
          projectId: '<uuid>',
          name: 'Orbit Group',
          type: 'single_select',
          options: [
            { id: '<uuid>', name: 'Amber' },
            { id: '<uuid>', name: 'Jade' },
          ],
          createdAt: '<timestamp>',
          updatedAt: '<timestamp>',
        },
      ],
      optionDeleteIsError: false,
      listAfterOptionDelete: [
        {
          id: '<uuid>',
          projectId: '<uuid>',
          name: 'Orbit Group',
          type: 'single_select',
          options: [{ id: '<uuid>', name: 'Amber' }],
          createdAt: '<timestamp>',
          updatedAt: '<timestamp>',
        },
      ],
      fieldDeleteIsError: false,
      listAfterFieldDelete: [],
    })
  })
})
