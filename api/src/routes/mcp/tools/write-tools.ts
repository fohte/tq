import type { McpServer } from '@modelcontextprotocol/server'

import {
  registerCreatePageTool,
  registerUpdatePageTool,
} from '#routes/mcp/tools/page-write-tools'
import {
  registerCreateTaskTool,
  registerUpdateTaskStatusTool,
  registerUpdateTaskTool,
} from '#routes/mcp/tools/task-write-tools'

export {
  registerCreatePageTool,
  registerUpdatePageTool,
} from '#routes/mcp/tools/page-write-tools'
export {
  registerCreateTaskTool,
  registerUpdateTaskStatusTool,
  registerUpdateTaskTool,
} from '#routes/mcp/tools/task-write-tools'

/** Write tools: creating, updating, and deleting tasks/projects/labels/etc. */
export function registerWriteTools(server: McpServer): void {
  registerCreateTaskTool(server)
  registerUpdateTaskTool(server)
  registerUpdateTaskStatusTool(server)
  registerCreatePageTool(server)
  registerUpdatePageTool(server)
}
