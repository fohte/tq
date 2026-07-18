import { registerReadTools } from '@api/routes/mcp/tools/read-tools'
import { registerWriteTools } from '@api/routes/mcp/tools/write-tools'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

export function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: 'tq', version: '0.1.0' },
    { capabilities: { tools: {} } },
  )

  // `registerTool` is what normally wires up the `tools/list` handler, but
  // no tools are registered below yet. Register it directly so `tools/list`
  // already works (returning an empty list); the first `registerTool` call
  // replaces this handler with the real one.
  server.server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: [] }))

  registerReadTools(server)
  registerWriteTools(server)

  return server
}
