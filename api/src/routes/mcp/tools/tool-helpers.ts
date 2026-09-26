import type { CallToolResult } from '@modelcontextprotocol/server'
import { z } from 'zod'

import { AUTHOR_HEADER } from '#lib/author'

// Model identity is supplied by the caller because tool calls carry no model name.
export const agentArgSchema = z
  .string()
  .min(1)
  .regex(/^[^\x00-\x1f\x7f]+$/, 'must not contain control characters')
  .optional()
  .describe(
    'Your own model name (e.g. "example-model"), so this write is ' +
      'attributed to you specifically in the edit history. Always pass ' +
      'this when you know it.',
  )

export function authorHeaderValue(agent: string | undefined): string {
  return `llm:${agent ?? 'mcp'}`
}

export function authorHeader(
  agent: string | undefined,
): Record<string, string> {
  return { [AUTHOR_HEADER]: authorHeaderValue(agent) }
}

export function toolResult(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] }
}
