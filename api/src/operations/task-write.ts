import { err, ok } from 'neverthrow'
import { z } from 'zod'

import { taskIdOrNumber } from '#lib/numeric-id'
import { encodePathSegment } from '#operations/path-segment'
import {
  recurrenceCliOptions,
  recurrenceRuleFromCli,
} from '#operations/recurrence-cli'
import {
  defineOperation,
  requestJson,
  requestNoContent,
} from '#operations/types'
import {
  createTaskSchema,
  taskStatus,
  taskStatusReason,
  updateTaskSchema,
} from '#schemas/task'

const taskIdSchema = z.object({ taskId: taskIdOrNumber })
const updateTaskInputSchema = updateTaskSchema.extend({
  taskId: taskIdOrNumber,
})
const taskStatusInputSchema = taskIdSchema.extend({ status: taskStatus })
const taskStatusToolInputSchema = taskIdSchema.extend({
  status: z.literal('todo'),
})
const taskParentInputSchema = taskIdSchema.extend({
  parentId: taskIdOrNumber.optional(),
})
const taskCompleteInputSchema = taskIdSchema.extend({
  statusReason: taskStatusReason.optional(),
  duplicateOfTaskId: taskIdOrNumber
    .describe('Task id or task number this task duplicates.')
    .optional(),
})
const fromGithubInputSchema = z.object({ url: z.string() })
const fromGithubToolInputSchema = z.object({ url: z.string().min(1) })

function optionString(
  options: Record<string, unknown>,
  name: string,
): string | undefined {
  const value = options[name]
  return typeof value === 'string' ? value : undefined
}

function mapCreateCliInput(
  input: Record<string, unknown>,
  options: Record<string, unknown>,
) {
  return recurrenceRuleFromCli(options).map((recurrenceRule) => ({
    ...input,
    ...(optionString(options, 'parentId') === undefined
      ? {}
      : { parentId: optionString(options, 'parentId') }),
    ...(recurrenceRule === undefined ? {} : { recurrenceRule }),
  }))
}

function mapUpdateCliInput(
  input: Record<string, unknown>,
  options: Record<string, unknown>,
) {
  return recurrenceRuleFromCli(options).andThen((recurrenceRule) => {
    const mappedInput = { ...input }
    if (recurrenceRule !== undefined) {
      mappedInput['recurrenceRule'] = recurrenceRule
    } else if (options['recurrence'] === false) {
      mappedInput['recurrenceRule'] = null
    }

    if (Object.keys(mappedInput).every((key) => key === 'taskId')) {
      return err(new Error('Pass at least one flag to update'))
    }
    return ok(mappedInput)
  })
}

function mapTaskStatusCliInput(input: Record<string, unknown>) {
  const parsed = taskStatusInputSchema.safeParse(input)
  return parsed.success
    ? ok(parsed.data)
    : err(new Error(parsed.error.issues[0]?.message ?? 'Invalid value'))
}

export const taskWriteOperations = [
  defineOperation(createTaskSchema, {
    path: ['task', 'create'],
    description:
      'Create a task. `labels` that do not match an existing label are ' +
      "created automatically, inheriting this task's context; an existing " +
      "label's context is unchanged. `recurrenceRule` makes the task recur: " +
      '`type` is daily/weekly/monthly/custom, `interval` is the repeat ' +
      'count (for example, 2 with weekly means every 2 weeks), `daysOfWeek` ' +
      'uses 0=Sunday through 6=Saturday for weekly rules, and `dayOfMonth` ' +
      'uses 1-31 for monthly rules. `blockedBy` lists task ids/numbers or ' +
      'GitHub issue/pull request URLs that must resolve first; unknown tasks ' +
      'return 404. `template` selects ' +
      'a description template by name; for LLM-authored tasks, omit it to ' +
      'use the default template when one is configured. The description must ' +
      'include content under every `##` section.',
    positionalArgs: ['title'],
    kind: 'write',
    attribution: 'agent',
    routes: ['POST /api/tasks'],
    cli: {
      commandOrder: 3,
      description: 'Create a task',
      excludeFields: ['parentId', 'recurrenceRule'],
      envDefaults: { context: 'TQ_CONTEXT' },
      commaSeparatedOptions: ['labels', 'blockedBy'],
      optionDescriptions: {
        labels:
          'Comma-separated label names to attach (unknown names are created)',
        blockedBy:
          'Comma-separated task ids/numbers or GitHub issue/pull request URLs blocking this task',
        template:
          'Description template name to validate for LLM-authored tasks',
      },
      optionMetavars: { labels: 'names', blockedBy: 'items', template: 'name' },
      customOptions: [
        {
          flags: '--parent-id <id>',
          description: 'Id or number of the parent task',
        },
        ...recurrenceCliOptions,
      ],
      mapInput: mapCreateCliInput,
      output: { kind: 'json-with-link-sync' },
    },
    run: (client, json) => requestJson(client.api.tasks.$post({ json })),
  }),
  defineOperation(updateTaskInputSchema, {
    path: ['task', 'update'],
    description:
      'Partially update a task by id or number. Only provided fields change; ' +
      'omit a field to leave it as-is. Nullable fields can be cleared with ' +
      'null. LLM description updates on template-bound tasks must preserve ' +
      'every required section; clearing the description is rejected. ' +
      '`labels` replaces the full set; an empty array clears it, and ' +
      "new labels inherit the task's possibly updated context while existing " +
      'label contexts stay unchanged. `blockedBy` also replaces the full ' +
      'set (task ids/numbers or GitHub issue/pull request URLs); an empty ' +
      'array clears every blocker. `recurrenceRule` has the ' +
      'same shape as task_create, or null to remove recurrence.',
    positionalArgs: [{ name: 'id', field: 'taskId' }],
    kind: 'write',
    attribution: 'agent',
    routes: ['PATCH /api/tasks/:id'],
    cli: {
      commandOrder: 4,
      description: 'Update a task',
      excludeFields: ['recurrenceRule'],
      commaSeparatedOptions: ['labels', 'blockedBy'],
      optionDescriptions: {
        blockedBy:
          'Comma-separated task ids/numbers or GitHub issue/pull request URLs blocking this task (replaces the full set; pass an empty string to clear)',
        labels:
          'Comma-separated label names to set (replaces the full set; unknown names are created; pass an empty string to clear)',
      },
      optionMetavars: { labels: 'names', blockedBy: 'items' },
      customOptions: [
        ...recurrenceCliOptions,
        {
          flags: '--no-recurrence',
          description: "Clear the task's recurrence rule",
        },
      ],
      mapInput: mapUpdateCliInput,
      output: { kind: 'json-with-link-sync' },
    },
    run: (client, { taskId, ...json }) =>
      requestJson(
        client.api.tasks[':id'].$patch({
          param: { id: encodePathSegment(String(taskId)) },
          json,
        }),
      ),
  }),
  defineOperation(taskIdSchema, {
    path: ['task', 'delete'],
    description: 'Delete a task.',
    positionalArgs: [{ name: 'id', field: 'taskId' }],
    kind: 'delete',
    routes: ['DELETE /api/tasks/:id'],
    cli: {
      commandOrder: 5,
      description: 'Delete a task',
      output: { kind: 'json' },
    },
    run: (client, { taskId }) =>
      requestNoContent(
        client.api.tasks[':id'].$delete({
          param: { id: encodePathSegment(String(taskId)) },
        }),
      ).map(() => ({ deleted: true, id: String(taskId) })),
  }),
  defineOperation(taskStatusInputSchema, {
    path: ['task', 'status'],
    description:
      'Reopen a task by setting its status to todo. To complete a task, use ' +
      'task_complete.',
    positionalArgs: [{ name: 'id', field: 'taskId' }, 'status'],
    kind: 'write',
    attribution: 'agent',
    routes: ['PATCH /api/tasks/:id/status'],
    mcpInputSchema: taskStatusToolInputSchema,
    cli: {
      commandOrder: 6,
      description: `Update task status (${taskStatus.options.join(', ')})`,
      mapInput: mapTaskStatusCliInput,
      output: { kind: 'json' },
    },
    run: (client, { taskId, status }) =>
      requestJson(
        client.api.tasks[':id'].status.$patch({
          param: { id: encodePathSegment(String(taskId)) },
          json: { status },
        }),
      ),
  }),
  defineOperation(taskParentInputSchema, {
    path: ['task', 'parent'],
    description:
      "Set a task's parent. Omit parentId to clear the current parent.",
    positionalArgs: [
      { name: 'id', field: 'taskId' },
      { name: 'parentId', optional: true },
    ],
    kind: 'write',
    routes: ['PATCH /api/tasks/:id/parent'],
    cli: {
      commandOrder: 7,
      description: "Set or clear a task's parent (omit parentId to clear it)",
      output: { kind: 'json' },
    },
    run: (client, { taskId, parentId }) =>
      requestJson(
        client.api.tasks[':id'].parent.$patch({
          param: { id: encodePathSegment(String(taskId)) },
          json: { parentId: parentId ?? null },
        }),
      ),
  }),
  defineOperation(taskCompleteInputSchema, {
    path: ['task', 'complete'],
    description:
      'Complete a task, optionally recording why it was closed and which ' +
      'task it duplicates. `duplicateOfTaskId` is used only when ' +
      '`statusReason` is duplicate.',
    positionalArgs: [{ name: 'id', field: 'taskId' }],
    kind: 'write',
    attribution: 'agent',
    routes: ['POST /api/tasks/:id/complete'],
    cli: {
      commandOrder: 8,
      description: 'Complete a task',
      optionNames: {
        statusReason: 'reason',
        duplicateOfTaskId: 'duplicate-of',
      },
      optionDescriptions: {
        statusReason: `Why the task is being closed (${taskStatusReason.options.join(', ')}); defaults to completed`,
        duplicateOfTaskId:
          'Task id or number this task is a duplicate of (only used when --reason duplicate)',
      },
      optionMetavars: {
        statusReason: 'reason',
        duplicateOfTaskId: 'taskId',
      },
      output: { kind: 'json' },
    },
    run: (client, { taskId, statusReason, duplicateOfTaskId }) =>
      requestJson(
        client.api.tasks[':id'].complete.$post({
          param: { id: encodePathSegment(String(taskId)) },
          json: { statusReason, duplicateOfTaskId },
        }),
      ),
  }),
  defineOperation(fromGithubInputSchema, {
    path: ['task', 'from-github'],
    description:
      'Create or find a task from a GitHub issue or pull request URL.',
    positionalArgs: ['url'],
    kind: 'write',
    routes: ['POST /api/tasks/from-github'],
    mcpInputSchema: fromGithubToolInputSchema,
    cli: {
      commandOrder: 12,
      description: 'Create a task from a GitHub issue or pull request URL',
      output: { kind: 'json' },
    },
    run: (client, json) =>
      requestJson(client.api.tasks['from-github'].$post({ json })),
  }),
] as const
