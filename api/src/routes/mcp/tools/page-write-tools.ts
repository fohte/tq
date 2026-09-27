import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import { taskIdOrNumber } from '#lib/numeric-id'
import { agentArgSchema } from '#routes/mcp/tools/tool-helpers'
import { callRoute } from '#routes/mcp/tools/write-tool-helpers'
import { createPageSchema, updatePageSchema } from '#schemas/task-page'

export function registerCreatePageTool(server: McpServer): void {
  server.registerTool(
    'create_page',
    {
      description:
        'Create a new page under a task. Pages hold longer-form content ' +
        "associated with a task, separate from the task's own " +
        '`description` field. Set `format: "html"` to save an HTML ' +
        'document instead of Markdown — it renders in a sandboxed iframe ' +
        "with no access to this app's cookies, localStorage, or API. " +
        'Prefer inlining any CSS/JS rather than referencing external ' +
        "files, since there's no guarantee an external resource stays " +
        'reachable when the page is viewed later. `sortOrder` controls ' +
        "display order among the task's pages and defaults to 0.",
      inputSchema: z.object({
        taskId: taskIdOrNumber,
        ...createPageSchema.shape,
        agent: agentArgSchema,
      }),
    },
    async ({ taskId, agent, ...body }) =>
      callRoute(`/api/tasks/${String(taskId)}/pages`, agent, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
  )
}

export function registerUpdatePageTool(server: McpServer): void {
  server.registerTool(
    'update_page',
    {
      description:
        'Partially update an existing page by task id and page id. Only ' +
        'the fields provided are changed; omit a field to leave it as-is.',
      inputSchema: z.object({
        taskId: taskIdOrNumber,
        pageId: z.uuid(),
        ...updatePageSchema.shape,
        agent: agentArgSchema,
      }),
    },
    async ({ taskId, pageId, agent, ...body }) =>
      callRoute(`/api/tasks/${String(taskId)}/pages/${pageId}`, agent, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
  )
}
