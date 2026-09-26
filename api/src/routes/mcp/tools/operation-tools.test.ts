import { McpServer } from '@modelcontextprotocol/server'
import { okAsync } from 'neverthrow'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import type { OperationDefinition } from '#operations/types'
import { registerOperationTools } from '#routes/mcp/tools/operation-tools'

function makeOperation(
  surface: OperationDefinition['surface'],
  command: string,
): OperationDefinition {
  return {
    path: ['demo', command],
    description: 'Exercise operation adapter behavior.',
    inputSchema: z.object({}),
    positionalArgs: [],
    kind: 'read',
    routes: [],
    ...(surface == null ? {} : { surface }),
    cli: { output: { kind: 'json' } },
    run: (_client, input) => okAsync(input),
  }
}

describe('registerOperationTools', () => {
  it('omits operations that are only available to the CLI', () => {
    const server = new McpServer(
      { name: 'test', version: '0.0.0' },
      { capabilities: { tools: {} } },
    )
    const registerTool = vi.spyOn(server, 'registerTool')

    registerOperationTools(server, [
      makeOperation(undefined, 'shared'),
      makeOperation(
        {
          only: 'cli',
          reason: 'This operation uses local files and terminal output.',
        },
        'local',
      ),
      makeOperation(
        {
          only: 'mcp',
          reason: 'This operation uses the remote MCP client context.',
        },
        'remote',
      ),
    ])

    expect(registerTool.mock.calls.map(([name]) => name)).toEqual([
      'demo_shared',
      'demo_remote',
    ])
  })
})
