import type { McpServer } from '@modelcontextprotocol/server'

import {
  registerGetPageTool,
  registerSearchPagesTool,
} from '#routes/mcp/tools/page-read-tools'
import { registerGetTodayTasksTool } from '#routes/mcp/tools/queue-read-tools'

/** Read-only tools: task lookups, search, etc. */
export function registerReadTools(server: McpServer): void {
  registerGetPageTool(server)
  registerSearchPagesTool(server)
  registerGetTodayTasksTool(server)
}
