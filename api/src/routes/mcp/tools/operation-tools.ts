import { captureWithFingerprint } from '@fohte/service-kit/observability'
import type { CallToolResult, McpServer } from '@modelcontextprotocol/server'
import { hc } from 'hono/client'
import { z } from 'zod'

import { app, type AppType } from '#app'
import type { taskDescriptionTemplates } from '#db/schema'
import { type OperationDefinition, operations } from '#operations/index'
import { toErrorResult } from '#routes/mcp/route-bridge'
import {
  agentArgSchema,
  authorHeader,
  toolResult,
} from '#routes/mcp/tools/tool-helpers'
import { descriptionTemplateHeadings } from '#routes/tasks/description-template-sections'

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
  const schema = operation.mcpInputSchema ?? operation.inputSchema
  if (operation.attribution !== 'agent') return schema
  return z.object({ ...schema.shape, agent: agentArgSchema })
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

export function operationToolName(operation: OperationDefinition): string {
  return operation.path.map((segment) => segment.replaceAll('-', '_')).join('_')
}

type DescriptionTemplate = Pick<
  typeof taskDescriptionTemplates.$inferSelect,
  'name' | 'whenToUse' | 'body' | 'guide' | 'isDefault'
>

function taskCreateTemplateGuidance(
  templates: readonly DescriptionTemplate[],
): string {
  return [
    'Current description templates:',
    'Choose the template that best fits the task, pass its name in `template`, and fill every listed section with substantive content following its guide.',
    ...templates.map((template) => {
      const headings = descriptionTemplateHeadings(template.body)
      return [
        `\`${template.name}\`${template.isDefault ? ' (default)' : ''}`,
        `When to use: ${template.whenToUse}`,
        'Sections:',
        headings.length === 0
          ? '(none)'
          : headings.map((heading) => `- ${heading}`).join('\n'),
        'Guide:',
        template.guide,
      ].join('\n')
    }),
  ].join('\n\n')
}

function withTaskCreateTemplates(
  operation: OperationDefinition,
  templates: readonly DescriptionTemplate[],
): OperationDefinition {
  if (
    operationToolName(operation) !== 'task_create' ||
    templates.length === 0
  ) {
    return operation
  }

  const schema = operation.mcpInputSchema ?? operation.inputSchema
  const templateNames = Object.fromEntries(
    templates.map(({ name }) => [name, name]),
  )

  return {
    ...operation,
    description: `${operation.description}\n\n${taskCreateTemplateGuidance(templates)}`,
    mcpInputSchema: schema.extend({
      template: z
        .enum(templateNames)
        .describe(
          'Description template name for LLM-authored tasks. If omitted, the default template is used when configured.',
        )
        .optional(),
    }),
  }
}

function requestErrorResult(message: string): CallToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
  }
}

export function registerOperationTools(
  server: McpServer,
  definitions: readonly OperationDefinition[] = operations,
  descriptionTemplates: readonly DescriptionTemplate[] = [],
): void {
  for (const operation of definitions) {
    if (operation.surface?.only === 'cli') continue
    const registeredOperation = withTaskCreateTemplates(
      operation,
      descriptionTemplates,
    )
    const inputSchema = inputSchemaFor(registeredOperation)
    server.registerTool(
      operationToolName(registeredOperation),
      {
        description: registeredOperation.description,
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
        const result = await registeredOperation.run(
          operationClient(registeredOperation, agent),
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
                { extras: { operation: operationToolName(operation) } },
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
