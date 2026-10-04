import { McpServer } from '@modelcontextprotocol/server'
import { asc, desc } from 'drizzle-orm'

import { db } from '#db/connection'
import { taskDescriptionTemplates } from '#db/schema'
import { operations } from '#operations/index'
import { registerOperationTools } from '#routes/mcp/tools/operation-tools'

export async function createMcpServer(): Promise<McpServer> {
  const descriptionTemplates = await db
    .select({
      name: taskDescriptionTemplates.name,
      whenToUse: taskDescriptionTemplates.whenToUse,
      body: taskDescriptionTemplates.body,
      guide: taskDescriptionTemplates.guide,
      isDefault: taskDescriptionTemplates.isDefault,
    })
    .from(taskDescriptionTemplates)
    .orderBy(
      desc(taskDescriptionTemplates.isDefault),
      asc(taskDescriptionTemplates.name),
    )

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

  registerOperationTools(server, operations, descriptionTemplates)

  return server
}
