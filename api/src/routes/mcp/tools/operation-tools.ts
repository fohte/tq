import type { CallToolResult, McpServer } from '@modelcontextprotocol/server'
import { commentOperations, type OperationDefinition } from 'api/operations'
import type { Hono } from 'hono'
import { hc } from 'hono/client'
import { z } from 'zod'

import type { AppType } from '#app'
import { AUTHOR_HEADER } from '#lib/author'
import { toErrorResult } from '#routes/mcp/route-bridge'

const DEFAULT_AGENT = 'mcp'

const agentArgSchema = z
  .string()
  .min(1)
  .regex(/^[^\x00-\x1f\x7f]+$/, 'must not contain control characters')
  .optional()
  .describe(
    'Your own model name (e.g. "example-model"), so this write is ' +
      'attributed to you specifically in the edit history. Always pass ' +
      'this when you know it.',
  )

async function resolveApp(): Promise<Hono> {
  // `#app` imports the MCP server through `routes/mcp/index.ts`, so importing
  // it here at module scope would create an initialization cycle.
  const { app } = await import('#app')
  return app
}

function authorHeaderValue(agent: string | undefined): string {
  return `llm:${agent ?? DEFAULT_AGENT}`
}

function operationClient(
  app: Hono,
  operation: OperationDefinition,
  agent: string | undefined,
) {
  return hc<AppType>('http://localhost', {
    fetch: (input: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      if (operation.kind !== 'read') {
        headers.set(AUTHOR_HEADER, authorHeaderValue(agent))
      }
      return app.request(input, { ...init, headers })
    },
  })
}

function toolResult(data: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
  }
}

function inputSchemaFor(operation: OperationDefinition) {
  if (operation.kind === 'read') return operation.inputSchema
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

function operationInput(
  parsedInput: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(parsedInput).filter(([key]) => key !== 'agent'),
  )
}

export function registerOperationTools(server: McpServer): void {
  for (const operation of commentOperations) {
    const inputSchema = inputSchemaFor(operation)
    server.registerTool(
      operation.path.join('_'),
      {
        description: operation.description,
        inputSchema,
        annotations: annotationsFor(operation),
      },
      async (input: unknown) => {
        const parsed = inputSchema.safeParse(input)
        if (!parsed.success) {
          const message = parsed.error.issues[0]?.message ?? 'Invalid request.'
          return requestErrorResult(`Invalid request: ${message}`)
        }

        const values = Object.fromEntries(Object.entries(parsed.data))
        const agent =
          typeof values['agent'] === 'string' ? values['agent'] : undefined
        const app = await resolveApp()
        const result = await operation.run(
          operationClient(app, operation, agent),
          operationInput(values),
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
