import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

import { app } from '#app'
import { AUTHOR_HEADER } from '#lib/author'
import { callInternalRoute } from '#routes/mcp/route-bridge'
import { createCommentSchema, updateCommentSchema } from '#routes/task-comments'
import { createPageSchema, updatePageSchema } from '#routes/task-pages'
import { createTaskSchema, updateTaskSchema } from '#routes/tasks/crud'
import { taskStatus } from '#routes/tasks/shared'

// Completing a task carries a side effect (generating the next occurrence of
// a recurring task) that a direct status write doesn't, so that transition
// goes through its action endpoint. Moving to `todo` or `in_progress` goes
// through `PATCH /api/tasks/:id/status` instead: `POST /:id/complete`
// requires the task not already be completed, which would reject a no-op
// completed -> completed call.
function toolResult(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] }
}

// A human never calls these write tools directly (humans use the web UI,
// which sends its own `X-Author: human`); the MCP protocol here is only ever
// driven by an LLM agent, so every write is recorded as `llm`, never
// `human`. There's no reliable way to learn the calling model's name from
// the MCP protocol itself (the stateless per-request server never observes
// the `initialize` handshake that carries `clientInfo`), so each write tool
// accepts an optional `agent` argument the caller can self-report; absent
// that, `mcp` is a generic stand-in identifying the channel rather than the
// agent.
const DEFAULT_AGENT = 'mcp'

const agentArgSchema = z
  .string()
  .min(1)
  .regex(/^[^\x00-\x1f\x7f]+$/, 'must not contain control characters')
  .optional()
  .describe(
    'Your own model name (e.g. "claude-opus-5"), so this write is ' +
      'attributed to you specifically in the edit history. Always pass ' +
      'this when you know it.',
  )

function authorHeaderValue(agent: string | undefined): string {
  return `llm:${agent ?? DEFAULT_AGENT}`
}

// Narrower than `RequestInit`: every call site here passes headers as a
// plain object (or omits them), never the `Headers`/`string[][]` shapes
// `RequestInit['headers']` also allows, so `headers` can be merged with a
// plain object spread below.
type RouteInit = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>
}

async function callRoute(
  path: string,
  agent: string | undefined,
  init: RouteInit = {},
): Promise<CallToolResult> {
  const result = await callInternalRoute(app, path, {
    ...init,
    headers: { ...init.headers, [AUTHOR_HEADER]: authorHeaderValue(agent) },
  })
  return result.ok ? toolResult(result.data) : result.result
}

/** Write tools: creating, updating, and deleting tasks/projects/labels/etc. */
export function registerWriteTools(server: McpServer): void {
  server.registerTool(
    'create_task',
    {
      description:
        'Create a new task. `labels` is an array of label names to attach; ' +
        'names that do not match an existing label are created ' +
        'automatically. `recurrenceRule`, when set, makes the task recur: ' +
        '`type` is one of daily/weekly/monthly/custom, `interval` is the ' +
        'repeat count (e.g. 2 with type weekly means every 2 weeks), ' +
        '`daysOfWeek` (0=Sunday..6=Saturday) restricts a weekly rule to ' +
        'specific days, and `dayOfMonth` (1-31) fixes the day for a ' +
        'monthly rule.',
      inputSchema: { ...createTaskSchema.shape, agent: agentArgSchema },
    },
    async ({ agent, ...input }) =>
      callRoute('/api/tasks', agent, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
  )

  server.registerTool(
    'update_task',
    {
      description:
        'Partially update an existing task by id. Only the fields provided ' +
        'are changed; omit a field to leave it as-is. Nullable fields ' +
        '(description, startDate, dueDate, estimatedMinutes, projectId, ' +
        'recurrenceRule) are cleared by passing null. `labels`, when ' +
        'provided, replaces the full set of labels on the task — pass an ' +
        'empty array to remove all labels; names that do not match an ' +
        'existing label are created automatically. `recurrenceRule` takes ' +
        'the same shape as in create_task, or null to remove recurrence ' +
        'from the task.',
      inputSchema: {
        taskId: z.uuid(),
        ...updateTaskSchema.shape,
        agent: agentArgSchema,
      },
    },
    async ({ taskId, agent, ...body }) =>
      callRoute(`/api/tasks/${taskId}`, agent, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
  )

  server.registerTool(
    'update_task_status',
    {
      description:
        'Change a task to todo, in_progress, or completed. Completing a ' +
        'task that has a recurrenceRule creates the next occurrence of ' +
        'that task. Completing an already-completed task is rejected.',
      inputSchema: {
        taskId: z.uuid(),
        status: taskStatus,
        agent: agentArgSchema,
      },
    },
    async ({ taskId, status, agent }) =>
      status === 'completed'
        ? callRoute(`/api/tasks/${taskId}/complete`, agent, { method: 'POST' })
        : callRoute(`/api/tasks/${taskId}/status`, agent, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          }),
  )

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
      inputSchema: {
        taskId: z.uuid(),
        ...createPageSchema.shape,
        agent: agentArgSchema,
      },
    },
    async ({ taskId, agent, ...body }) =>
      callRoute(`/api/tasks/${taskId}/pages`, agent, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
  )

  server.registerTool(
    'update_page',
    {
      description:
        'Partially update an existing page by task id and page id. Only ' +
        'the fields provided are changed; omit a field to leave it as-is.',
      inputSchema: {
        taskId: z.uuid(),
        pageId: z.uuid(),
        ...updatePageSchema.shape,
        agent: agentArgSchema,
      },
    },
    async ({ taskId, pageId, agent, ...body }) =>
      callRoute(`/api/tasks/${taskId}/pages/${pageId}`, agent, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
  )

  server.registerTool(
    'create_comment',
    {
      description: 'Add a comment to a task.',
      inputSchema: {
        taskId: z.uuid(),
        ...createCommentSchema.shape,
        agent: agentArgSchema,
      },
    },
    async ({ taskId, agent, ...body }) =>
      callRoute(`/api/tasks/${taskId}/comments`, agent, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
  )

  server.registerTool(
    'update_comment',
    {
      description:
        'Update the content of an existing comment by task id and comment id.',
      inputSchema: {
        taskId: z.uuid(),
        commentId: z.uuid(),
        ...updateCommentSchema.shape,
        agent: agentArgSchema,
      },
    },
    async ({ taskId, commentId, agent, ...body }) =>
      callRoute(`/api/tasks/${taskId}/comments/${commentId}`, agent, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
  )
}
