import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import { taskIdOrNumber } from '#lib/numeric-id'
import { buildQuery, callAsResult } from '#routes/mcp/tools/read-tool-helpers'

export function registerGetPageTool(server: McpServer): void {
  server.registerTool(
    'get_page',
    {
      description:
        "Get the full content of a single page (a task note) by id. get_task lists a task's pages as metadata only — resolve taskId and pageId from an entry in its `pages` array before calling this.",
      inputSchema: z.object({
        taskId: taskIdOrNumber.describe(
          'The id (UUID) or number of the task the page belongs to.',
        ),
        pageId: z.uuid().describe('The page id to look up.'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ taskId, pageId }) =>
      callAsResult(`/api/tasks/${String(taskId)}/pages/${pageId}`),
  )
}

export function registerSearchPagesTool(server: McpServer): void {
  server.registerTool(
    'search_pages',
    {
      description:
        'Find where a phrase appears across task pages, comments, and task title or description. Returns matching locations with the task number, page identity when applicable, a snippet, and match metadata; it does not return page content. Use get_page with the returned task number and page id when the full page is needed.',
      inputSchema: z.object({
        q: z
          .string()
          .trim()
          .min(1)
          .describe(
            'Free-text phrase to search across pages, comments, and tasks.',
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe(
            'Maximum number of matching locations to return (1-50). Defaults to 20.',
          ),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ q, limit }) =>
      callAsResult(
        `/api/tasks/search/pages${buildQuery({
          q,
          limit: limit?.toString(),
        })}`,
      ),
  )
}
