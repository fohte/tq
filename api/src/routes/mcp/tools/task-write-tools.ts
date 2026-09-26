import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import { taskIdOrNumber } from '#lib/numeric-id'
import { agentArgSchema } from '#routes/mcp/tools/tool-helpers'
import { callRoute } from '#routes/mcp/tools/write-tool-helpers'
import {
  createTaskSchema,
  taskStatus,
  taskStatusReason,
  updateTaskSchema,
} from '#schemas/task'

export function registerCreateTaskTool(server: McpServer): void {
  server.registerTool(
    'create_task',
    {
      description:
        'Create a new task. `labels` is an array of label names to attach; ' +
        'names that do not match an existing label are created ' +
        "automatically, inheriting this task's context — an existing " +
        "label's context is left unchanged. `recurrenceRule`, when set, " +
        'makes the task recur: ' +
        '`type` is one of daily/weekly/monthly/custom, `interval` is the ' +
        'repeat count (e.g. 2 with type weekly means every 2 weeks), ' +
        '`daysOfWeek` (0=Sunday..6=Saturday) restricts a weekly rule to ' +
        'specific days, and `dayOfMonth` (1-31) fixes the day for a ' +
        'monthly rule. `blockedBy` is an array of task ids or numbers that ' +
        'must complete before this task can, resolved to a 404 if any of ' +
        'them do not exist.',
      inputSchema: z.object({
        ...createTaskSchema.shape,
        agent: agentArgSchema,
      }),
    },
    async ({ agent, ...input }) =>
      callRoute('/api/tasks', agent, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
  )
}

export function registerUpdateTaskTool(server: McpServer): void {
  server.registerTool(
    'update_task',
    {
      description:
        'Partially update an existing task by id. Only the fields provided ' +
        'are changed; omit a field to leave it as-is. Nullable fields ' +
        '(description, startDate, dueDate, estimatedMinutes, projectId, ' +
        'recurrenceRule, remindAt) are cleared by passing null. `labels`, when ' +
        'provided, replaces the full set of labels on the task — pass an ' +
        'empty array to remove all labels; names that do not match an ' +
        "existing label are created automatically, inheriting the task's " +
        "(possibly just-updated) context — an existing label's context is " +
        'left unchanged. `recurrenceRule` takes the same shape as in ' +
        'create_task, or null to remove recurrence from the task.',
      inputSchema: z.object({
        taskId: taskIdOrNumber,
        ...updateTaskSchema.shape,
        agent: agentArgSchema,
      }),
    },
    async ({ taskId, agent, ...body }) =>
      callRoute(`/api/tasks/${String(taskId)}`, agent, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
  )
}

export function registerUpdateTaskStatusTool(server: McpServer): void {
  server.registerTool(
    'update_task_status',
    {
      description:
        'Change a task to todo or completed. Completing an already-completed ' +
        'task is rejected. When closing a task (status: completed), ' +
        'optionally pass statusReason to record why it was closed, and, ' +
        "when statusReason is 'duplicate', duplicateOfTaskId to record " +
        'which task it duplicates.',
      inputSchema: z.object({
        taskId: taskIdOrNumber,
        status: taskStatus,
        statusReason: taskStatusReason.optional(),
        duplicateOfTaskId: z.uuid().optional(),
        agent: agentArgSchema,
      }),
    },
    // Completing routes through /complete since only it rejects an
    // already-completed task with 409; todo routes through the plain
    // /status PATCH.
    async ({ taskId, status, statusReason, duplicateOfTaskId, agent }) =>
      status === 'completed'
        ? callRoute(`/api/tasks/${String(taskId)}/complete`, agent, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ statusReason, duplicateOfTaskId }),
          })
        : callRoute(`/api/tasks/${String(taskId)}/status`, agent, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          }),
  )
}
