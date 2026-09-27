import { McpServer } from '@modelcontextprotocol/server'
import { describe, expect, it, vi } from 'vitest'

import { githubOperations } from '#operations/github'
import { registerOperationTools } from '#routes/mcp/tools/operation-tools'

describe('GitHub operation tools', () => {
  it('registers noun-first tool names with annotations from each operation kind', () => {
    const server = new McpServer(
      { name: 'test', version: '0.0.0' },
      { capabilities: { tools: {} } },
    )
    const registerTool = vi.spyOn(server, 'registerTool')

    registerOperationTools(server, githubOperations)

    expect(
      registerTool.mock.calls.map(([name, { annotations }]) => ({
        name,
        annotations,
      })),
    ).toEqual([
      {
        name: 'github_link',
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      {
        name: 'github_unlink',
        annotations: { readOnlyHint: false, destructiveHint: true },
      },
      {
        name: 'github_sync',
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      { name: 'github_resolve', annotations: { readOnlyHint: true } },
    ])
  })
})
