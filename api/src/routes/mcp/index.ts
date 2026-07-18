import { createMcpServer } from '@api/routes/mcp/server'
import { StreamableHTTPTransport } from '@hono/mcp'
import { Hono } from 'hono'

const mcpServer = createMcpServer()

// Stateless mode: omitting `sessionIdGenerator` disables session tracking.
// Every tool call is a synchronous CRUD operation with no server-initiated
// notifications, so there is no need to keep per-client state between
// requests. (`exactOptionalPropertyTypes` rejects passing the property as
// `undefined` explicitly, so it must be omitted rather than set.)
const transport = new StreamableHTTPTransport()

export const mcpApp = new Hono().all('/', async (c) => {
  if (!mcpServer.isConnected()) {
    await mcpServer.connect(transport)
  }
  return transport.handleRequest(c)
})
