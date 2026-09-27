import type { CallToolResult } from '@modelcontextprotocol/server'
import type { Hono } from 'hono'

import { callInternalRoute } from '#routes/mcp/route-bridge'

export async function resolveApp(): Promise<Hono> {
  // `#app` imports `mcpApp` through the read tool modules that use this
  // helper, so importing it at module scope here would form an import cycle.
  // Resolving it lazily inside each handler breaks the cycle: by the time a
  // tool call runs, the module graph has already finished loading.
  const { app } = await import('#app')
  return app
}

export function buildQuery(params: Record<string, string | undefined>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, value)
  }
  const qs = query.toString()
  return qs === '' ? '' : `?${qs}`
}

export async function callAsResult(path: string): Promise<CallToolResult> {
  const app = await resolveApp()
  const result = await callInternalRoute(app, path)
  return result.ok
    ? { content: [{ type: 'text', text: JSON.stringify(result.data) }] }
    : result.result
}
