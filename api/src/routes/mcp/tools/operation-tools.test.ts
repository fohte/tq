import { McpServer } from '@modelcontextprotocol/server'
import { makeOperation } from 'api/operations/test-fixtures'
import { describe, expect, it, vi } from 'vitest'

import { registerOperationTools } from '#routes/mcp/tools/operation-tools'

describe('registerOperationTools', () => {
  it('omits operations that are only available to the CLI', () => {
    const server = new McpServer(
      { name: 'test', version: '0.0.0' },
      { capabilities: { tools: {} } },
    )
    const registerTool = vi.spyOn(server, 'registerTool')

    registerOperationTools(server, [
      makeOperation({ path: ['demo', 'shared'] }),
      makeOperation({
        path: ['demo', 'local'],
        surface: {
          only: 'cli',
          reason: 'This operation uses local files and terminal output.',
        },
      }),
      makeOperation({
        path: ['demo', 'remote'],
        surface: {
          only: 'mcp',
          reason: 'This operation uses the remote MCP client context.',
        },
      }),
    ])

    expect(registerTool.mock.calls.map(([name]) => name)).toEqual([
      'demo_shared',
      'demo_remote',
    ])
  })
})
