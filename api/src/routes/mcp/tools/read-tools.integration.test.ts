import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  callMcpTool,
  connectMcpClient,
  normalizeDynamicValues,
  parseToolJson,
} from '#routes/mcp/testing'
import { createLabel } from '#routes/tasks/testing'
import { setupTestDb } from '#testing'

setupTestDb()

let client: Client

beforeEach(async () => {
  client = await connectMcpClient()
})

afterEach(async () => {
  await client.close()
})

describe('read tools', () => {
  it('declares label_list as read-only', async () => {
    const result = await client.listTools()

    expect(
      result.tools
        .filter((tool) => tool.name === 'label_list')
        .map((tool) => ({
          name: tool.name,
          readOnlyHint: tool.annotations?.readOnlyHint,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    ).toEqual([{ name: 'label_list', readOnlyHint: true }])
  })

  describe('label_list', () => {
    it('returns all labels', async () => {
      const label = await createLabel('urgent')

      const toolResult = await callMcpTool(client, 'label_list')

      expect(parseToolJson(toolResult)).toEqual([
        {
          id: label.id,
          name: 'urgent',
          color: label.color,
          context: label.context,
          createdAt: label.createdAt.toISOString(),
        },
      ])
    })

    it('returns labels in the requested context', async () => {
      await createLabel('work-label', { context: 'work' })
      await createLabel('personal-label', { context: 'personal' })

      const toolResult = await callMcpTool(client, 'label_list', {
        context: 'work',
      })

      expect(normalizeDynamicValues(parseToolJson(toolResult))).toEqual([
        {
          id: '<uuid>',
          name: 'work-label',
          color: null,
          context: 'work',
          createdAt: '<timestamp>',
        },
      ])
    })
  })
})
