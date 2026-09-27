import type { McpServer } from '@modelcontextprotocol/server'

import {
  registerGetTaskTool,
  registerListTasksTool,
  registerSearchTasksTool,
} from '#routes/mcp/tools/task-read-tools'

/** Read-only tools: task lookups, search, etc. */
export function registerReadTools(server: McpServer): void {
  registerListTasksTool(server)
  registerGetTaskTool(server)
  registerSearchTasksTool(server)
}
