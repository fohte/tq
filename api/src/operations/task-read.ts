import { errAsync, okAsync } from 'neverthrow'
import { z } from 'zod'

import { taskIdOrNumber } from '#lib/numeric-id'
import { nestTaskListRows } from '#lib/task-tree'
import {
  allTaskRowsQuery,
  taskListDefaults,
  taskSearchDefaults,
} from '#operations/task-query-defaults'
import {
  defineOperation,
  type OperationClient,
  type OperationError,
  requestJson,
} from '#operations/types'
import type { ListTasksQuery } from '#schemas/task'
import { listTasksQuerySchema, taskListContext } from '#schemas/task'
import { timezoneOffsetMinutesSchema } from '#schemas/timezone'
import { parseSearchQuery } from '#search-query-parser'

type TaskDetail = Record<string, unknown> & {
  id: string
  pages: Record<string, unknown>[]
}
type TaskListRow = Record<string, unknown> & {
  id: string
  parentId: string | null
}
type TaskListQuery = NonNullable<
  Parameters<OperationClient['api']['tasks']['$get']>[0]
>['query']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTaskDetail(value: unknown): value is TaskDetail {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    Array.isArray(value['pages']) &&
    value['pages'].every(isRecord)
  )
}

function isTaskListRow(value: unknown): value is TaskListRow {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    (value['parentId'] === null || typeof value['parentId'] === 'string')
  )
}

function isTaskListRows(value: unknown): value is TaskListRow[] {
  return Array.isArray(value) && value.every(isTaskListRow)
}

function invalidResponse(message: string): OperationError {
  return { kind: 'request', error: new Error(message) }
}

const booleanOption = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => value === true || value === 'true')

const taskListInputSchema = listTasksQuerySchema
  .omit({
    hasDue: true,
    includeMatch: true,
    candidatesOn: true,
    view: true,
  })
  .extend({
    full: z
      .boolean()
      .optional()
      .describe('Include each task description in the results.'),
    includeMatch: booleanOption
      .optional()
      .describe('Include the matched text in results.'),
    includeAncestors: booleanOption
      .optional()
      .describe('Include ancestors of matching tasks in results.'),
    q: listTasksQuerySchema.shape.q.describe(
      'Free-text query, optionally containing prefixed filter tokens.',
    ),
    status: listTasksQuerySchema.shape.status
      .optional()
      .describe(
        `Only return tasks in this status. Defaults to all when ids are specified, or ${taskListDefaults.status.join(', ')} otherwise.`,
      ),
    statusReason: listTasksQuerySchema.shape.statusReason.describe(
      'Only return tasks closed with this reason.',
    ),
    projectId: listTasksQuerySchema.shape.projectId.describe(
      'Only return tasks belonging to this project id.',
    ),
    parentId: listTasksQuerySchema.shape.parentId.describe(
      "Only return direct subtasks of this task UUID or number, or 'root' for tasks with no parent.",
    ),
    context: taskListContext
      .optional()
      .describe(
        'Only return tasks in this context. Defaults to the TQ_CONTEXT environment variable when set in the CLI, or all otherwise.',
      ),
    limit: listTasksQuerySchema.shape.limit
      .optional()
      .describe(
        `Maximum number of results to return (1-100 or unlimited). Defaults to ${String(taskListDefaults.limit)}.`,
      ),
  })

const taskSearchInputSchema = listTasksQuerySchema
  .omit({
    hasDue: true,
    includeMatch: true,
    candidatesOn: true,
    view: true,
  })
  .extend({
    full: z
      .boolean()
      .optional()
      .describe('Include each task description in the results.'),
    includeMatch: booleanOption
      .optional()
      .describe('Include the matched text in results.'),
    includeAncestors: booleanOption
      .optional()
      .describe('Include ancestors of matching tasks in results.'),
    q: listTasksQuerySchema.shape.q.describe(
      'Free-text query, optionally containing prefixed filter tokens.',
    ),
    status: listTasksQuerySchema.shape.status
      .optional()
      .describe(
        'Only return tasks in this status. Equivalent to is: in q. Defaults to all.',
      ),
    statusReason: listTasksQuerySchema.shape.statusReason.describe(
      'Only return tasks closed with this reason. Equivalent to reason: in q.',
    ),
    label: listTasksQuerySchema.shape.label.describe(
      'Only return tasks with this label or a descendant label. Equivalent to label: in q.',
    ),
    context: taskListContext
      .optional()
      .describe(
        'Only return tasks in this context. Equivalent to context: in q. Defaults to the TQ_CONTEXT environment variable when set in the CLI, or all otherwise.',
      ),
    hasDue: booleanOption
      .optional()
      .describe(
        'Only return tasks that have (true) or lack (false) a due date.',
      ),
    sortBy: listTasksQuerySchema.shape.sortBy.describe(
      'Sort order for results. Defaults to creation date.',
    ),
    limit: listTasksQuerySchema.shape.limit
      .optional()
      .describe(
        `Maximum number of results to return (1-100 or unlimited). Defaults to ${String(taskSearchDefaults.limit)}.`,
      ),
    offset: listTasksQuerySchema.shape.offset.describe(
      'Number of results to skip, for pagination.',
    ),
  })

const taskListMcpInputSchema = taskListInputSchema.extend({
  context: taskListInputSchema.shape.context.default(taskListDefaults.context),
  limit: taskListInputSchema.shape.limit.default(taskListDefaults.limit),
  tzOffset: timezoneOffsetMinutesSchema,
})

const taskSearchMcpInputSchema = taskSearchInputSchema.extend({
  context: taskSearchInputSchema.shape.context.default(
    taskSearchDefaults.context,
  ),
  limit: taskSearchInputSchema.shape.limit.default(taskSearchDefaults.limit),
  tzOffset: timezoneOffsetMinutesSchema,
})

const taskIdInputSchema = z.object({
  taskId: taskIdOrNumber.describe(
    'The task id (UUID) or task number to look up.',
  ),
})

function toTaskQuery(fields: ListTasksQuery): TaskListQuery {
  const queryFields = { ...fields }
  if (
    queryFields['tzOffset'] === undefined &&
    typeof queryFields['q'] === 'string' &&
    parseSearchQuery(queryFields['q']).hasFollowUpDue === true
  ) {
    queryFields['tzOffset'] = new Date().getTimezoneOffset()
  }
  const query: Record<string, string | string[]> = Object.fromEntries(
    Object.entries(queryFields)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [
        key,
        Array.isArray(value) ? value.map(String) : String(value),
      ]),
  )
  return {
    ...query,
    view: fields.view,
    context: fields.context,
    status: fields.status,
    limit: String(fields.limit),
  }
}

function toPageMetadata(page: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(page).filter(
      ([key]) => !['content', 'preview', 'contentTruncated'].includes(key),
    ),
  )
}

function getTaskWithSubtasks(client: OperationClient, taskId: string | number) {
  return requestJson(
    client.api.tasks[':id'].$get({ param: { id: String(taskId) } }),
  ).andThen((taskResult) => {
    if (!isTaskDetail(taskResult)) {
      return errAsync(invalidResponse('The task detail response is invalid.'))
    }
    return requestJson(
      client.api.tasks.$get({
        query: {
          ...allTaskRowsQuery,
          descendantOf: taskResult.id,
        },
      }),
    ).andThen((descendantResult) => {
      if (!isTaskListRows(descendantResult)) {
        return errAsync(
          invalidResponse('The task descendants response is invalid.'),
        )
      }
      return okAsync({
        ...taskResult,
        pages: taskResult.pages.map(toPageMetadata),
        subtasks: nestTaskListRows(descendantResult),
      })
    })
  })
}

export const taskReadOperations = [
  defineOperation(taskListInputSchema, {
    path: ['task', 'list'],
    description:
      'List tasks by status, project, parent, context, or other supported filters, including an optional free-text query. Descriptions are omitted by default; set full to include them.',
    positionalArgs: [],
    kind: 'read',
    routes: ['GET /api/tasks'],
    mcpInputSchema: taskListMcpInputSchema,
    cli: {
      group: { description: 'Manage tasks', order: 1 },
      commandOrder: 0,
      excludeFields: ['tzOffset'],
      envDefaults: { context: 'TQ_CONTEXT' },
      output: {
        kind: 'list',
        fullOption: '--full',
        fullDescription: 'Include full task description in the output',
        fullField: 'full',
      },
    },
    run: (client, input) => {
      const { full, ...filters } = input
      return requestJson(
        client.api.tasks.$get({
          query: toTaskQuery({
            ...filters,
            view: full === true ? 'full' : 'row',
            context: input.context ?? taskListDefaults.context,
            status:
              input.status ??
              (input.ids === undefined ? taskListDefaults.status : ['all']),
            limit: input.limit ?? taskListDefaults.limit,
          }),
        }),
      )
    },
  }),
  defineOperation(taskIdInputSchema, {
    path: ['task', 'get'],
    description:
      "Get a task's full detail: attributes, recurrence rule, time blocks, page metadata, checklist trees and leaf-item progress, linked tasks (mentions or pasted task URLs, as links.outgoing/links.incoming), labels, and nested subtask summaries. Subtask descriptions are omitted; use task_get (or CLI: task get) on a subtask to retrieve its description. Each page is metadata only (id, taskId, title, sortOrder, timestamps, author) with no content.",
    positionalArgs: [{ name: 'id', field: 'taskId' }],
    kind: 'read',
    routes: ['GET /api/tasks/:id', 'GET /api/tasks'],
    cli: { commandOrder: 1, output: { kind: 'json' } },
    run: (client, { taskId }) => getTaskWithSubtasks(client, taskId),
  }),
  defineOperation(taskSearchInputSchema, {
    path: ['task', 'search'],
    description:
      'Search tasks using the TQ search bar query syntax. The q string matches title, description, and page content, and accepts filter tokens that combine with free text: is:todo|completed (repeat is: to match multiple statuses), reason:completed|not_planned|duplicate, label:<name> (also matches descendants under a /-separated path), context:work|personal, commitment:inbox|active|someday, has:pages|comments|no-children|blockers|no-blockers|follow-up-due, parent:<uuid|number>|root, project:<uuid|title>, and sort:due|created|updated. has:follow-up-due matches tasks with an unresolved wait whose follow-up date is today or earlier in the client timezone. For example, q: "is:todo label:example context:work planning" finds matching todo tasks whose title, description, or pages mention planning. The same filters are available as explicit parameters. Task descriptions are omitted from results by default; set full to include them.',
    positionalArgs: [{ name: 'query', field: 'q', optional: true }],
    kind: 'read',
    routes: ['GET /api/tasks'],
    mcpInputSchema: taskSearchMcpInputSchema,
    cli: {
      commandOrder: 9,
      excludeFields: ['tzOffset'],
      envDefaults: { context: 'TQ_CONTEXT' },
      output: {
        kind: 'list',
        fullOption: '--full',
        fullDescription: 'Include full task description in the output',
        fullField: 'full',
      },
    },
    run: (client, input) => {
      const { full, ...filters } = input
      return requestJson(
        client.api.tasks.$get({
          query: toTaskQuery({
            ...filters,
            view: full === true ? 'full' : 'row',
            context: input.context ?? taskSearchDefaults.context,
            status: input.status ?? taskSearchDefaults.status,
            limit: input.limit ?? taskSearchDefaults.limit,
          }),
        }),
      )
    },
  }),
  defineOperation(taskIdInputSchema, {
    path: ['task', 'activity'],
    description: 'Get the activity history of a task.',
    positionalArgs: [{ name: 'id', field: 'taskId' }],
    kind: 'read',
    routes: ['GET /api/tasks/:id/activity'],
    cli: { commandOrder: 10, output: { kind: 'json' } },
    run: (client, { taskId }) =>
      requestJson(
        client.api.tasks[':id'].activity.$get({
          param: { id: String(taskId) },
        }),
      ),
  }),
  defineOperation(taskIdInputSchema, {
    path: ['task', 'sessions'],
    description: 'List agent sessions linked to a task.',
    positionalArgs: [{ name: 'id', field: 'taskId' }],
    kind: 'read',
    routes: ['GET /api/tasks/:taskId/agent-sessions'],
    cli: { commandOrder: 11, output: { kind: 'json' } },
    run: (client, { taskId }) =>
      requestJson(
        client.api.tasks[':taskId']['agent-sessions'].$get({
          param: { taskId: String(taskId) },
        }),
      ),
  }),
  defineOperation(z.object({ id: taskIdOrNumber }), {
    path: ['task', 'url'],
    description: "Print a task's web URL.",
    positionalArgs: ['id'],
    kind: 'read',
    routes: [],
    surface: {
      only: 'cli',
      reason:
        'The web URL depends on CLI configuration that is unavailable to MCP operations.',
    },
    cli: {
      commandOrder: 2,
      output: { kind: 'web-url', path: '/tasks/{id}' },
    },
    run: () => okAsync(undefined),
  }),
] as const
