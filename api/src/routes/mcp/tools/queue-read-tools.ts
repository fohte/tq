import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import { buildQuery, callAsResult } from '#routes/mcp/tools/read-tool-helpers'

export function registerGetTodayTasksTool(server: McpServer): void {
  server.registerTool(
    'get_today_tasks',
    {
      description:
        "Get the tasks in the Today queue: the tasks a user has staged to work on for a given day, in queue order. Omitting date defaults to the server's current UTC date, which may not match the caller's local calendar day; pass an explicit date to get a specific (e.g. the caller's local) day.",
      inputSchema: z.object({
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
          .optional()
          .describe(
            "Date to fetch the Today queue for, as YYYY-MM-DD. Defaults to the server's current UTC date.",
          ),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ date }) =>
      callAsResult(
        `/api/queues/day/items${buildQuery({
          date: date ?? new Date().toISOString().slice(0, 10),
        })}`,
      ),
  )
}
