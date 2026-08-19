import { createMcpHandler } from '@modelcontextprotocol/server'
import { Hono } from 'hono'

import { createMcpServer } from '#routes/mcp/server'

// Built once at module scope: `handler.fetch` itself calls the factory fresh
// for every request (both the modern per-request-envelope path and the
// legacy stateless fallback), so a fresh `McpServer` per request does not
// require constructing a fresh handler.
const handler = createMcpHandler(() => createMcpServer())

export const mcpApp = new Hono().all('/', (c) => handler.fetch(c.req.raw))
