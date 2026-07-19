import { registerReadTools } from '@api/routes/mcp/tools/read-tools'
import { registerWriteTools } from '@api/routes/mcp/tools/write-tools'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: 'tq', version: '0.1.0' },
    { capabilities: { tools: {} } },
  )

  // `registerTool`'s first call is what wires up the SDK's own `tools/list`
  // and `tools/call` handlers; it throws if a handler for those methods is
  // already installed. Registering (and immediately removing) a placeholder
  // triggers that wiring so `tools/list` already works with no tools
  // registered, without pre-installing a handler that would make the first
  // real `registerTool` call below throw.
  server
    .registerTool('_placeholder', { description: 'placeholder' }, () => ({
      content: [],
    }))
    .remove()

  registerReadTools(server)
  registerWriteTools(server)

  return server
}
