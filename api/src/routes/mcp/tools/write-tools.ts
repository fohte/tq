import type { McpServer } from '@modelcontextprotocol/server'

import {
  registerCreateTaskTool,
  registerUpdateTaskStatusTool,
  registerUpdateTaskTool,
} from '#routes/mcp/tools/task-write-tools'

/** Write tools: creating, updating, and deleting tasks/projects/labels/etc. */
export function registerWriteTools(server: McpServer): void {
  registerCreateTaskTool(server)
  registerUpdateTaskTool(server)
  registerUpdateTaskStatusTool(server)
}
