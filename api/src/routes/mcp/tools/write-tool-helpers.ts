import type { CallToolResult } from '@modelcontextprotocol/server'

import { app } from '#app'
import { callInternalRoute } from '#routes/mcp/route-bridge'
import { authorHeader, toolResult } from '#routes/mcp/tools/tool-helpers'

// Narrower than `RequestInit`: every call site here passes headers as a
// plain object (or omits them), never the `Headers`/`string[][]` shapes
// `RequestInit['headers']` also allows, so `headers` can be merged with a
// plain object spread below.
type RouteInit = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>
}

export async function callRoute(
  path: string,
  agent: string | undefined,
  init: RouteInit = {},
): Promise<CallToolResult> {
  const result = await callInternalRoute(app, path, {
    ...init,
    headers: { ...init.headers, ...authorHeader(agent) },
  })
  return result.ok ? toolResult(result.data) : result.result
}
