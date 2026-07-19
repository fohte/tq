import { app } from '@api/app'
import { callInternalRoute } from '@api/routes/mcp/route-bridge'
import { createTaskSchema, updateTaskSchema } from '@api/routes/tasks/crud'
import { taskStatus } from '@api/routes/tasks/shared'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

// Starting and completing a task carry side effects (opening a TimeBlock,
// generating the next occurrence of a recurring task) that a direct status
// write doesn't, so those two transitions go through their action endpoints.
// Moving to `todo` goes through `PATCH /api/tasks/:id/status` instead of
// `POST /:id/stop`: `/stop` requires the task to currently be in_progress,
// which would reject a legitimate "reopen a completed task" or a no-op
// todo -> todo call; `PATCH /status` still closes an open TimeBlock when
// transitioning away from in_progress, just without echoing it back.
const START_OR_COMPLETE_PATHS = {
  in_progress: 'start',
  completed: 'complete',
} as const

function toolResult(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] }
}

async function callRoute(
  path: string,
  init?: RequestInit,
): Promise<CallToolResult> {
  const result = await callInternalRoute(app, path, init)
  return result.ok ? toolResult(result.data) : result.result
}

/** Write tools: creating, updating, and deleting tasks/projects/labels/etc. */
export function registerWriteTools(server: McpServer): void {
  server.registerTool(
    'create_task',
    {
      description:
        'Create a new task. `labels` is an array of existing label names ' +
        '(not label IDs); names that do not match any existing label are ' +
        'ignored. `recurrenceRule`, when set, makes the task recur: `type` ' +
        'is one of daily/weekly/monthly/custom, `interval` is the repeat ' +
        'count (e.g. 2 with type weekly means every 2 weeks), `daysOfWeek` ' +
        '(0=Sunday..6=Saturday) restricts a weekly rule to specific days, ' +
        'and `dayOfMonth` (1-31) fixes the day for a monthly rule.',
      inputSchema: createTaskSchema.shape,
    },
    async (input) =>
      callRoute('/api/tasks', {
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
        'recurrenceRule) are cleared by passing null. `recurrenceRule` ' +
        'takes the same shape as in create_task, or null to remove ' +
        'recurrence from the task.',
      inputSchema: { taskId: z.uuid(), ...updateTaskSchema.shape },
    },
    async ({ taskId, ...body }) =>
      callRoute(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
  )

  server.registerTool(
    'update_task_status',
    {
      description:
        'Change a task to todo, in_progress, or completed. Moving to ' +
        'in_progress opens a TimeBlock; moving away from in_progress ' +
        'closes it. Completing a task that has a recurrenceRule creates ' +
        'the next occurrence of that task. An invalid transition (e.g. ' +
        'starting a task that is already in_progress) is rejected.',
      inputSchema: { taskId: z.uuid(), status: taskStatus },
    },
    async ({ taskId, status }) =>
      status === 'todo'
        ? callRoute(`/api/tasks/${taskId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          })
        : callRoute(`/api/tasks/${taskId}/${START_OR_COMPLETE_PATHS[status]}`, {
            method: 'POST',
          }),
  )
}
