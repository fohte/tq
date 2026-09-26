import { captureWithFingerprint } from '@fohte/service-kit/observability'
import type { CallToolResult, McpServer } from '@modelcontextprotocol/server'
import { hc } from 'hono/client'
import { z } from 'zod'

import { app, type AppType } from '#app'
import { type OperationDefinition, operations } from '#operations/index'
import { toErrorResult } from '#routes/mcp/route-bridge'
import {
  agentArgSchema,
  authorHeader,
  toolResult,
} from '#routes/mcp/tools/tool-helpers'

function operationClient(
  operation: OperationDefinition,
  agent: string | undefined,
) {
  return hc<AppType>('http://localhost', {
    fetch: (input: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      if (operation.attribution === 'agent') {
        for (const [key, value] of Object.entries(authorHeader(agent))) {
          headers.set(key, value)
        }
      }
      return app.request(input, { ...init, headers })
    },
  })
}

function inputSchemaFor(operation: OperationDefinition) {
  if (operation.attribution !== 'agent') return operation.inputSchema
  return z.object({ ...operation.inputSchema.shape, agent: agentArgSchema })
}

function annotationsFor(operation: OperationDefinition) {
  switch (operation.kind) {
    case 'read':
      return { readOnlyHint: true }
    case 'write':
      return { readOnlyHint: false, destructiveHint: false }
    case 'delete':
      return { readOnlyHint: false, destructiveHint: true }
  }
}

function requestErrorResult(message: string): CallToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
  }
}

export function registerOperationTools(server: McpServer): void {
  for (const operation of operations) {
    const inputSchema = inputSchemaFor(operation)
    server.registerTool(
      operation.path.join('_'),
      {
        description: operation.description,
        inputSchema,
        annotations: annotationsFor(operation),
      },
      async (input: z.output<typeof inputSchema>) => {
        let agent: string | undefined
        let operationValues: object = input
        if ('agent' in input) {
          const { agent: providedAgent, ...rest } = input
          agent = typeof providedAgent === 'string' ? providedAgent : undefined
          operationValues = rest
        }
        const result = await operation.run(
          operationClient(operation, agent),
          operationValues,
        )

        if (result.isErr()) {
          switch (result.error.kind) {
            case 'input':
              return requestErrorResult(
                `Invalid request: ${result.error.message}`,
              )
            case 'http':
              return toErrorResult(result.error.response)
            case 'request':
              captureWithFingerprint(
                result.error.error,
                'api.mcp.operation-request-failed',
                { extras: { operation: operation.path.join('_') } },
              )
              return requestErrorResult(
                'An internal error occurred while processing the request.',
              )
          }
        }

        return toolResult(result.value)
      },
    )
  }
}
