import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import { taskIdOrNumber } from '#lib/numeric-id'
import { callInternalRoute } from '#routes/mcp/route-bridge'
import {
  buildQuery,
  callAsResult,
  resolveApp,
} from '#routes/mcp/tools/read-tool-helpers'
import { pageToResponse } from '#routes/task-pages'
import {
  nestTaskListRows,
  type TaskListItemResponse,
} from '#routes/tasks/shared'
import { contextEnum, taskStatus, taskStatusReason } from '#schemas/task'

type PageDetail = ReturnType<typeof pageToResponse>

type TaskDetail = Record<string, unknown> & { pages: PageDetail[] }

type TaskListRow = TaskListItemResponse & {
  childCompletionCount: { completed: number; total: number }
}

// `get_task` drops page `content` to keep the response small — pages are
// meant for notes that can grow arbitrarily long, so returning it here would
// let a single call inflate the agent's context with the full text of every
// page on the task. Callers fetch a specific page's content with `get_page`.
function toPageMetadata(page: PageDetail): Omit<PageDetail, 'content'> {
  return {
    id: page.id,
    taskId: page.taskId,
    title: page.title,
    format: page.format,
    sortOrder: page.sortOrder,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
    author: page.author,
  }
}

export function registerListTasksTool(server: McpServer): void {
  server.registerTool(
    'list_tasks',
    {
      description:
        'List tasks, optionally filtered by status, project, parent task, or context. Returns all matching tasks with no limit or pagination; combine filters to keep the result set small. Use search_tasks instead for free-text search, label filtering, sorting, or pagination.',
      inputSchema: z.object({
        status: taskStatus
          .optional()
          .describe('Only return tasks in this status.'),
        statusReason: taskStatusReason
          .optional()
          .describe('Only return tasks closed with this reason.'),
        projectId: z
          .uuid()
          .optional()
          .describe(
            'Only return tasks belonging to this project id. Resolve project ids with project_list.',
          ),
        parentId: z
          .union([z.literal('root'), z.uuid()])
          .optional()
          .describe(
            "Only return direct subtasks of this task id, or 'root' to return only tasks with no parent.",
          ),
        context: contextEnum
          .optional()
          .describe('Only return tasks in this context.'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ status, statusReason, projectId, parentId, context }) =>
      callAsResult(
        `/api/tasks${buildQuery({ status, statusReason, projectId, parentId, context })}`,
      ),
  )
}

export function registerGetTaskTool(server: McpServer): void {
  server.registerTool(
    'get_task',
    {
      description:
        "Get the full detail of a single task by id: its attributes, recurrence rule, time blocks, page metadata, linked tasks (mentions via `#<number>` or a pasted task URL, as `links.outgoing`/`links.incoming`), labels, and the nested subtree of its subtasks (as `subtasks`, each entry including its own labels). Each entry in `pages` is metadata only (id, taskId, title, sortOrder, timestamps, author) with no `content` — pass its `id` and this task's `id` to get_page to read a page's content.",
      inputSchema: z.object({
        taskId: taskIdOrNumber.describe(
          'The task id (UUID) or task number to look up.',
        ),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ taskId }) => {
      const app = await resolveApp()

      // `descendantOf` already implements subtree traversal via a recursive
      // CTE, returning a flat array of all descendants; nestTaskListRows
      // turns that into the subtree, with the target task's direct children
      // naturally ending up as roots since the task itself is never in the
      // result set.
      const [taskResult, descendantsResult] = await Promise.all([
        callInternalRoute<TaskDetail>(app, `/api/tasks/${String(taskId)}`),
        callInternalRoute<TaskListRow[]>(
          app,
          `/api/tasks${buildQuery({ descendantOf: String(taskId) })}`,
        ),
      ])
      if (!taskResult.ok) return taskResult.result
      if (!descendantsResult.ok) return descendantsResult.result

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ...taskResult.data,
              pages: taskResult.data.pages.map(toPageMetadata),
              subtasks: nestTaskListRows(descendantsResult.data),
            }),
          },
        ],
      }
    },
  )
}

export function registerSearchTasksTool(server: McpServer): void {
  server.registerTool(
    'search_tasks',
    {
      description:
        'Search tasks using the same query syntax as the TQ search bar. The `q` string does a free-text match across title, description, and page content, and also accepts prefixed filter tokens that can be combined with free text and with each other: `is:todo|completed` (repeat `is:` to match multiple statuses, e.g. `is:todo is:completed`), `reason:completed|not_planned|duplicate` (only tasks closed with this reason), `label:<name>` (also matches descendant labels under a `/`-separated path, e.g. `dev` matches `dev/tq`), `context:work|personal`, `commitment:inbox|active|someday`, `has:pages`, `has:comments`, `has:no-children` (excludes tasks with an incomplete child), `has:blockers` (has an unresolved blocker), `has:no-blockers` (no unresolved blockers, i.e. ready to start), `parent:<uuid>|root` (`root` matches tasks with no parent), `project:<uuid|title>`, `sort:due|created|updated|estimate`. Example: `q: "is:todo label:urgent context:work groceries"` finds todo tasks labeled urgent in the work context whose title, description, or pages mention "groceries". The same filters are also available as explicit parameters for when a query string is not needed.',
      inputSchema: z.object({
        q: z
          .string()
          .optional()
          .describe(
            'Free-text query, optionally containing prefixed filter tokens (see tool description).',
          ),
        status: taskStatus
          .optional()
          .describe(
            'Only return tasks in this status. Equivalent to is: in q.',
          ),
        statusReason: taskStatusReason
          .optional()
          .describe(
            'Only return tasks closed with this reason. Equivalent to reason: in q.',
          ),
        label: z
          .string()
          .optional()
          .describe(
            'Only return tasks with this label name, or a descendant label under a `/`-separated path (e.g. `dev` also matches `dev/tq`). Equivalent to label: in q.',
          ),
        context: contextEnum
          .optional()
          .describe(
            'Only return tasks in this context. Equivalent to context: in q.',
          ),
        hasEstimate: z
          .boolean()
          .optional()
          .describe(
            'Only return tasks that have (true) or lack (false) an estimated duration.',
          ),
        hasDue: z
          .boolean()
          .optional()
          .describe(
            'Only return tasks that have (true) or lack (false) a due date.',
          ),
        sortBy: z
          .enum(['due', 'created', 'updated', 'estimate'])
          .optional()
          .describe('Sort order for results. Defaults to creation date.'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe(
            'Maximum number of results to return (1-100). Defaults to 20.',
          ),
        offset: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe('Number of results to skip, for pagination.'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({
      q,
      status,
      statusReason,
      label,
      context,
      hasEstimate,
      hasDue,
      sortBy,
      limit,
      offset,
    }) =>
      callAsResult(
        `/api/tasks${buildQuery({
          q,
          status,
          statusReason,
          label,
          context,
          hasEstimate: hasEstimate?.toString(),
          hasDue: hasDue?.toString(),
          sortBy,
          limit: (limit ?? 20).toString(),
          offset: offset?.toString(),
        })}`,
      ),
  )
}
