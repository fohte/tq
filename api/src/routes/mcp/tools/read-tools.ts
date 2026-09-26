import type { McpServer } from '@modelcontextprotocol/server'

import {
  registerGetPageTool,
  registerSearchPagesTool,
} from '#routes/mcp/tools/page-read-tools'
import { registerGetTodayTasksTool } from '#routes/mcp/tools/queue-read-tools'
import {
  registerGetTaskTool,
  registerListTasksTool,
  registerSearchTasksTool,
} from '#routes/mcp/tools/task-read-tools'

export {
  registerGetPageTool,
  registerSearchPagesTool,
} from '#routes/mcp/tools/page-read-tools'
export { registerGetTodayTasksTool } from '#routes/mcp/tools/queue-read-tools'
export {
  registerGetTaskTool,
  registerListTasksTool,
  registerSearchTasksTool,
} from '#routes/mcp/tools/task-read-tools'

/** Read-only tools: task lookups, search, etc. */
export function registerReadTools(server: McpServer): void {
  registerListTasksTool(server)
  registerGetTaskTool(server)
  registerGetPageTool(server)
  registerSearchTasksTool(server)
  registerSearchPagesTool(server)
  registerGetTodayTasksTool(server)
}
