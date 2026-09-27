import type { McpServer } from '@modelcontextprotocol/server'

import {
  registerCreatePageTool,
  registerUpdatePageTool,
} from '#routes/mcp/tools/page-write-tools'

/** Page write tools. */
export function registerWriteTools(server: McpServer): void {
  registerCreatePageTool(server)
  registerUpdatePageTool(server)
}
