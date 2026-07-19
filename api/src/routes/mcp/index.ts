import { createMcpServer } from '@api/routes/mcp/server'
import { StreamableHTTPTransport } from '@hono/mcp'
import { Hono } from 'hono'

export const mcpApp = new Hono().all('/', async (c) => {
  // A fresh transport and server per request (rather than sharing a module-scoped
  // instance) is required in stateless mode: the transport keys pending responses
  // by the client's JSON-RPC request id alone, so two concurrent clients reusing
  // the same instance can have their responses cross-delivered when ids collide.
  //
  // Stateless mode: omitting `sessionIdGenerator` disables session tracking.
  // Every tool call is a synchronous CRUD operation with no server-initiated
  // notifications, so there is no need to keep per-client state between
  // requests. (`exactOptionalPropertyTypes` rejects passing the property as
  // `undefined` explicitly, so it must be omitted rather than set.)
  const transport = new StreamableHTTPTransport()
  const mcpServer = createMcpServer()
  await mcpServer.connect(transport)
  return transport.handleRequest(c)
})
