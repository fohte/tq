import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { Hono } from 'hono'
import { z } from 'zod'

import { callInternalRoute } from '#routes/mcp/route-bridge'
import { pageToResponse } from '#routes/task-pages'
import {
  nestTaskListRows,
  taskIdOrNumber,
  type TaskListItemResponse,
} from '#routes/tasks/shared'
import { projectStatus } from '#schemas/project'
import { contextEnum, taskStatus } from '#schemas/task'

async function resolveApp(): Promise<Hono> {
  // `#app` imports `mcpApp` (routes/mcp/index.ts -> server.ts -> this
  // file), so importing it at module scope here would form an import cycle.
  // Resolving it lazily inside each handler breaks the cycle: by the time a
  // tool call runs, the module graph has already finished loading.
  const { app } = await import('#app')
  return app
}

function buildQuery(params: Record<string, string | undefined>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, value)
  }
  const qs = query.toString()
  return qs === '' ? '' : `?${qs}`
}

async function callAsResult(path: string): Promise<CallToolResult> {
  const app = await resolveApp()
  const result = await callInternalRoute(app, path)
  return result.ok
    ? { content: [{ type: 'text', text: JSON.stringify(result.data) }] }
    : result.result
}

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

/** Read-only tools: task/project/label lookups, search, etc. */
export function registerReadTools(server: McpServer): void {
  server.registerTool(
    'list_tasks',
    {
      description:
        'List tasks, optionally filtered by status, project, parent task, or context. Returns all matching tasks with no limit or pagination; combine filters to keep the result set small. Use search_tasks instead for free-text search, label filtering, sorting, or pagination.',
      inputSchema: {
        status: taskStatus
          .optional()
          .describe('Only return tasks in this status.'),
        projectId: z
          .uuid()
          .optional()
          .describe(
            'Only return tasks belonging to this project id. Resolve project ids with list_projects.',
          ),
        parentId: z
          .uuid()
          .optional()
          .describe('Only return direct subtasks of this task id.'),
        context: contextEnum
          .optional()
          .describe('Only return tasks in this context.'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ status, projectId, parentId, context }) =>
      callAsResult(
        `/api/tasks${buildQuery({ status, projectId, parentId, context })}`,
      ),
  )

  server.registerTool(
    'get_task',
    {
      description:
        "Get the full detail of a single task by id: its attributes, recurrence rule, time blocks, page metadata, linked tasks (mentions via `#<number>`, as `links.outgoing`/`links.incoming`), labels, and the nested subtree of its subtasks (as `subtasks`). Each entry in `pages` is metadata only (id, taskId, title, sortOrder, timestamps, author) with no `content` — pass its `id` and this task's `id` to get_page to read a page's content. Entries in `subtasks` do not include labels; use search_tasks with a label: filter to find tasks by label.",
      inputSchema: {
        taskId: taskIdOrNumber.describe(
          'The task id (UUID) or task number to look up.',
        ),
      },
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

  server.registerTool(
    'get_page',
    {
      description:
        "Get the full content of a single page (a task note) by id. get_task lists a task's pages as metadata only — resolve taskId and pageId from an entry in its `pages` array before calling this.",
      inputSchema: {
        taskId: taskIdOrNumber.describe(
          'The id (UUID) or number of the task the page belongs to.',
        ),
        pageId: z.uuid().describe('The page id to look up.'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ taskId, pageId }) =>
      callAsResult(`/api/tasks/${String(taskId)}/pages/${pageId}`),
  )

  server.registerTool(
    'search_tasks',
    {
      description:
        'Search tasks using the same query syntax as the TQ search bar. The `q` string does a free-text match across title, description, and page content, and also accepts prefixed filter tokens that can be combined with free text and with each other: `is:todo|in_progress|completed`, `label:<name>`, `context:work|personal`, `has:pages`, `has:comments`, `parent:<uuid>`, `project:<uuid>`, `sort:due|created|updated|estimate`. Example: `q: "is:todo label:urgent context:work groceries"` finds todo tasks labeled urgent in the work context whose title, description, or pages mention "groceries". The same filters are also available as explicit parameters for when a query string is not needed.',
      inputSchema: {
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
        label: z
          .string()
          .optional()
          .describe(
            'Only return tasks with this label name. Equivalent to label: in q.',
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
      },
      annotations: { readOnlyHint: true },
    },
    async ({
      q,
      status,
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
          label,
          context,
          hasEstimate: hasEstimate?.toString(),
          hasDue: hasDue?.toString(),
          sortBy,
          limit: limit?.toString(),
          offset: offset?.toString(),
        })}`,
      ),
  )

  server.registerTool(
    'get_today_tasks',
    {
      description:
        "Get the tasks in the Today queue: the tasks a user has staged to work on for a given day, in queue order. Omitting date defaults to the server's current UTC date, which may not match the caller's local calendar day; pass an explicit date to get a specific (e.g. the caller's local) day.",
      inputSchema: {
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
          .optional()
          .describe(
            "Date to fetch the Today queue for, as YYYY-MM-DD. Defaults to the server's current UTC date.",
          ),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ date }) =>
      callAsResult(
        `/api/schedule/today-tasks${buildQuery({
          date: date ?? new Date().toISOString().slice(0, 10),
        })}`,
      ),
  )

  server.registerTool(
    'list_projects',
    {
      description:
        "List projects, optionally filtered by status. Use this to resolve a project's id before passing projectId to list_tasks or create_task.",
      inputSchema: {
        status: projectStatus
          .optional()
          .describe('Only return projects in this status.'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ status }) =>
      callAsResult(`/api/projects${buildQuery({ status })}`),
  )

  server.registerTool(
    'list_labels',
    {
      description:
        'List all labels available for tagging tasks, with their id, name, and color. Use this to resolve label names before filtering search_tasks by label or attaching labels to a task.',
      annotations: { readOnlyHint: true },
    },
    async () => callAsResult('/api/labels'),
  )
}
