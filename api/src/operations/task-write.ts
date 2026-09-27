import { err, ok, type Result } from 'neverthrow'
import { z } from 'zod'

import { taskIdOrNumber } from '#lib/numeric-id'
import { encodePathSegment } from '#operations/path-segment'
import {
  defineOperation,
  requestJson,
  requestNoContent,
} from '#operations/types'
import { recurrenceRuleSchema } from '#schemas/recurrence-rule'
import {
  createTaskSchema,
  taskStatus,
  taskStatusReason,
  updateTaskSchema,
} from '#schemas/task'

const cliTaskIdentifier = z.union([z.string(), z.number()])
const taskIdSchema = z.object({ taskId: cliTaskIdentifier })
const taskIdToolSchema = z.object({ taskId: taskIdOrNumber })
const createTaskInputSchema = createTaskSchema.extend({
  parentId: cliTaskIdentifier.optional(),
})
const updateTaskInputSchema = updateTaskSchema.extend({
  taskId: cliTaskIdentifier,
})
const updateTaskToolInputSchema = updateTaskSchema.extend({
  taskId: taskIdOrNumber,
})
const taskStatusInputSchema = taskIdSchema.extend({ status: taskStatus })
const taskStatusToolInputSchema = taskIdToolSchema.extend({
  status: z.literal('todo'),
})
const taskParentInputSchema = taskIdSchema.extend({
  parentId: cliTaskIdentifier.optional(),
})
const taskParentToolInputSchema = taskIdToolSchema.extend({
  parentId: taskIdOrNumber.optional(),
})
const taskCompleteInputSchema = taskIdSchema.extend({
  statusReason: taskStatusReason.optional(),
  duplicateOfTaskId: z.string().optional(),
})
const taskCompleteToolInputSchema = taskIdToolSchema.extend({
  statusReason: taskStatusReason.optional(),
  duplicateOfTaskId: z.uuid().optional(),
})
const fromGithubInputSchema = z.object({ url: z.string() })
const fromGithubToolInputSchema = z.object({ url: z.string().min(1) })

const recurrenceCliOptions = [
  {
    flags: '--recurrence-type <type>',
    description:
      'Recurrence rule type (daily/weekly/monthly/custom); requires --recurrence-interval',
  },
  {
    flags: '--recurrence-interval <n>',
    description:
      'Recurrence interval (e.g. 2 with type weekly means every 2 weeks)',
  },
  {
    flags: '--recurrence-days-of-week <days>',
    description:
      'Comma-separated days of week for a weekly rule (0=Sunday..6=Saturday)',
  },
  {
    flags: '--recurrence-day-of-month <day>',
    description: 'Day of month (1-31) for a monthly rule',
  },
] as const

type RecurrenceRule = z.infer<typeof recurrenceRuleSchema>

function optionString(
  options: Record<string, unknown>,
  name: string,
): string | undefined {
  const value = options[name]
  return typeof value === 'string' ? value : undefined
}

function splitCommaList(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

function recurrenceRuleFromCli(
  options: Record<string, unknown>,
): Result<RecurrenceRule | undefined, Error> {
  const type = optionString(options, 'recurrenceType')
  const interval = optionString(options, 'recurrenceInterval')
  const daysOfWeek = optionString(options, 'recurrenceDaysOfWeek')
  const dayOfMonth = optionString(options, 'recurrenceDayOfMonth')

  if (
    type === undefined &&
    interval === undefined &&
    daysOfWeek === undefined &&
    dayOfMonth === undefined
  ) {
    return ok(undefined)
  }

  const parsed = recurrenceRuleSchema.safeParse({
    type,
    interval: Number(interval),
    ...(daysOfWeek === undefined
      ? {}
      : { daysOfWeek: splitCommaList(daysOfWeek).map(Number) }),
    ...(dayOfMonth === undefined ? {} : { dayOfMonth: Number(dayOfMonth) }),
  })

  return parsed.success
    ? ok(parsed.data)
    : err(new Error(parsed.error.issues[0]?.message ?? 'Invalid value'))
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
  defineOperation(createTaskInputSchema, {
    path: ['task', 'create'],
    description:
      'Create a task. Labels that do not exist are created automatically. ' +
      'Use recurrenceRule to make the task recur and blockedBy to list tasks ' +
      'that must complete first.',
    positionalArgs: ['title'],
    kind: 'write',
    attribution: 'agent',
    routes: ['POST /api/tasks'],
    mcpInputSchema: createTaskSchema,
    cli: {
      description: 'Create a task',
      excludeFields: ['parentId', 'recurrenceRule'],
      envDefaults: { context: 'TQ_CONTEXT' },
      commaSeparatedOptions: ['labels', 'blockedBy'],
      optionDescriptions: {
        labels:
          'Comma-separated label names to attach (unknown names are created)',
        blockedBy: 'Comma-separated ids/numbers of tasks blocking this task',
      },
      optionMetavars: { labels: 'names', blockedBy: 'ids' },
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
      'Partially update a task. Only provided fields are changed. Nullable ' +
      'fields can be cleared with null; labels and blockedBy replace their ' +
      'full sets.',
    positionalArgs: [{ name: 'id', field: 'taskId' }],
    kind: 'write',
    attribution: 'agent',
    routes: ['PATCH /api/tasks/:id'],
    mcpInputSchema: updateTaskToolInputSchema,
    cli: {
      description: 'Update a task',
      excludeFields: ['recurrenceRule'],
      commaSeparatedOptions: ['labels', 'blockedBy'],
      optionDescriptions: {
        blockedBy:
          'Comma-separated ids/numbers of tasks blocking this task (replaces the full set; pass an empty string to clear)',
        labels:
          'Comma-separated label names to set (replaces the full set; unknown names are created; pass an empty string to clear)',
      },
      optionMetavars: { labels: 'names', blockedBy: 'ids' },
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
    mcpInputSchema: taskIdToolSchema,
    cli: { description: 'Delete a task', output: { kind: 'json' } },
    run: (client, { taskId }) =>
      requestNoContent(
        client.api.tasks[':id'].$delete({
          param: { id: encodePathSegment(String(taskId)) },
        }),
      ).map(() => ({ deleted: true, id: String(taskId) })),
  }),
  defineOperation(taskStatusInputSchema, {
    path: ['task', 'status'],
    description: 'Update a task status.',
    positionalArgs: [{ name: 'id', field: 'taskId' }, 'status'],
    kind: 'write',
    attribution: 'agent',
    routes: ['PATCH /api/tasks/:id/status'],
    mcpInputSchema: taskStatusToolInputSchema,
    cli: {
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
    mcpInputSchema: taskParentToolInputSchema,
    cli: {
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
      'task it duplicates.',
    positionalArgs: [{ name: 'id', field: 'taskId' }],
    kind: 'write',
    attribution: 'agent',
    routes: ['POST /api/tasks/:id/complete'],
    mcpInputSchema: taskCompleteToolInputSchema,
    cli: {
      description: 'Complete a task',
      optionNames: {
        statusReason: 'reason',
        duplicateOfTaskId: 'duplicate-of',
      },
      optionDescriptions: {
        statusReason: `Why the task is being closed (${taskStatusReason.options.join(', ')}); defaults to completed`,
        duplicateOfTaskId:
          'Task id this task is a duplicate of (only used when --reason duplicate)',
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
      description: 'Create a task from a GitHub issue or pull request URL',
      output: { kind: 'json' },
    },
    run: (client, json) =>
      requestJson(client.api.tasks['from-github'].$post({ json })),
  }),
] as const
