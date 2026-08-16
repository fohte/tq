import {
  createTaskSchema,
  listTasksQuerySchema,
  taskStatus,
  updateTaskSchema,
} from 'api/schemas/task'
import type { Command } from 'commander'
import type { InferRequestType } from 'hono/client'

import type { Client } from '#client'
import { toApiError } from '#client'
import { buildClient } from '#command-context'
import { printJson, printJsonList } from '#output'
import { fail } from '#result'
import { addSchemaOptions, pickSchemaFields } from '#schema-options'

type ListTasksQuery = InferRequestType<Client['api']['tasks']['$get']>['query']
type CreateTaskJson = InferRequestType<Client['api']['tasks']['$post']>['json']
type UpdateTaskJson = InferRequestType<
  Client['api']['tasks'][':id']['$patch']
>['json']
type UpdateStatusJson = InferRequestType<
  Client['api']['tasks'][':id']['status']['$patch']
>['json']
type UpdateParentJson = InferRequestType<
  Client['api']['tasks'][':id']['parent']['$patch']
>['json']
type SearchQuery = InferRequestType<Client['api']['tasks']['$get']>['query']
type FromGithubJson = InferRequestType<
  Client['api']['tasks']['from-github']['$post']
>['json']

// hono's client types every query field as `string | string[] | undefined`
// regardless of the underlying zod schema, so numbers/enums picked from the
// schema (real types) must be stringified before being sent as a query.
function toQuery(fields: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, String(value)]),
  )
}

export function registerTaskCommands(
  program: Command,
  fetchImpl: typeof fetch,
): void {
  const task = program.command('task').description('Manage tasks')

  addSchemaOptions(
    task
      .command('list')
      .description('List tasks')
      .option('--full', 'Include full task description in the output'),
    listTasksQuerySchema,
    // hasEstimate/hasDue/includeAncestors unwrap to a raw ZodString (their
    // pre-transform type), so addSchemaOptions would expose them but without
    // true/false validation (any string round-trips through the
    // 'v === "true"' transform silently, e.g. a typo'd value becomes false).
    // Excluded until that gets its own stricter boolean flag type.
    ['hasEstimate', 'hasDue', 'includeAncestors'],
  )
    .match(
      (command) => command,
      (error) => fail(task, error),
    )
    .action(
      async (
        options: Record<string, unknown> & { full?: boolean },
        command: Command,
      ) => {
        const client = buildClient(command, fetchImpl).match(
          (value) => value,
          (error) => fail(command, error),
        )
        const query: ListTasksQuery = toQuery(
          pickSchemaFields(listTasksQuerySchema, options, [
            'hasEstimate',
            'hasDue',
            'includeAncestors',
          ]).match(
            (value) => value,
            (error) => fail(command, error),
          ),
        )
        const res = await client.api.tasks.$get({ query })
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- the route only declares a 200 response, so `res.ok` is always true at the type level; kept as a defense against status codes (e.g. from a proxy in front of the API) the client types don't know about
        if (!res.ok) return fail(command, await toApiError(res))
        printJsonList(await res.json(), 'description', { full: options.full })
      },
    )

  task
    .command('get <id>')
    .description('Get a task')
    .action(async (id: string, _options: unknown, command: Command) => {
      const client = buildClient(command, fetchImpl).match(
        (value) => value,
        (error) => fail(command, error),
      )
      const res = await client.api.tasks[':id'].$get({ param: { id } })
      if (!res.ok) return fail(command, await toApiError(res))
      printJson(await res.json())
    })

  addSchemaOptions(
    task.command('create <title>').description('Create a task'),
    createTaskSchema,
    // labels (array) and recurrenceRule (object) aren't scalar fields, so addSchemaOptions can't turn them into flags.
    ['title', 'labels', 'recurrenceRule'],
  )
    .match(
      (command) => command,
      (error) => fail(task, error),
    )
    .action(
      async (
        title: string,
        options: Record<string, unknown>,
        command: Command,
      ) => {
        const client = buildClient(command, fetchImpl).match(
          (value) => value,
          (error) => fail(command, error),
        )
        const json: CreateTaskJson = {
          ...pickSchemaFields(createTaskSchema, options, [
            'title',
            'labels',
            'recurrenceRule',
          ]).match(
            (value) => value,
            (error) => fail(command, error),
          ),
          title,
        }
        const res = await client.api.tasks.$post({ json })
        if (!res.ok) return fail(command, await toApiError(res))
        printJson(await res.json())
      },
    )

  addSchemaOptions(
    task.command('update <id>').description('Update a task'),
    updateTaskSchema,
    ['labels', 'recurrenceRule'],
  )
    .match(
      (command) => command,
      (error) => fail(task, error),
    )
    .action(
      async (
        id: string,
        options: Record<string, unknown>,
        command: Command,
      ) => {
        const json: UpdateTaskJson = pickSchemaFields(
          updateTaskSchema,
          options,
          ['labels', 'recurrenceRule'],
        ).match(
          (value) => value,
          (error) => fail(command, error),
        )
        if (Object.keys(json).length === 0) {
          return fail(command, new Error('Pass at least one flag to update'))
        }

        const client = buildClient(command, fetchImpl).match(
          (value) => value,
          (error) => fail(command, error),
        )
        const res = await client.api.tasks[':id'].$patch({
          param: { id },
          json,
        })
        if (!res.ok) return fail(command, await toApiError(res))
        printJson(await res.json())
      },
    )

  task
    .command('delete <id>')
    .description('Delete a task')
    .action(async (id: string, _options: unknown, command: Command) => {
      const client = buildClient(command, fetchImpl).match(
        (value) => value,
        (error) => fail(command, error),
      )
      const res = await client.api.tasks[':id'].$delete({ param: { id } })
      if (!res.ok) return fail(command, await toApiError(res))
      printJson({ deleted: true, id })
    })

  task
    .command('status <id> <status>')
    .description(`Update task status (${taskStatus.options.join(', ')})`)
    .action(
      async (
        id: string,
        status: string,
        _options: unknown,
        command: Command,
      ) => {
        const parsed = taskStatus.safeParse(status)
        if (!parsed.success) {
          return fail(
            command,
            new Error(parsed.error.issues[0]?.message ?? 'Invalid value'),
          )
        }

        const client = buildClient(command, fetchImpl).match(
          (value) => value,
          (error) => fail(command, error),
        )
        const json: UpdateStatusJson = { status: parsed.data }
        const res = await client.api.tasks[':id'].status.$patch({
          param: { id },
          json,
        })
        if (!res.ok) return fail(command, await toApiError(res))
        printJson(await res.json())
      },
    )

  task
    .command('parent <id> [parentId]')
    .description("Set or clear a task's parent (omit parentId to clear it)")
    .action(
      async (
        id: string,
        parentId: string | undefined,
        _options: unknown,
        command: Command,
      ) => {
        const client = buildClient(command, fetchImpl).match(
          (value) => value,
          (error) => fail(command, error),
        )
        const json: UpdateParentJson = { parentId: parentId ?? null }
        const res = await client.api.tasks[':id'].parent.$patch({
          param: { id },
          json,
        })
        if (!res.ok) return fail(command, await toApiError(res))
        printJson(await res.json())
      },
    )

  task
    .command('complete <id>')
    .description('Complete a task')
    .action(async (id: string, _options: unknown, command: Command) => {
      const client = buildClient(command, fetchImpl).match(
        (value) => value,
        (error) => fail(command, error),
      )
      const res = await client.api.tasks[':id'].complete.$post({
        param: { id },
      })
      if (!res.ok) return fail(command, await toApiError(res))
      printJson(await res.json())
    })

  task
    .command('activity <id>')
    .description('Get task activity')
    .action(async (id: string, _options: unknown, command: Command) => {
      const client = buildClient(command, fetchImpl).match(
        (value) => value,
        (error) => fail(command, error),
      )
      const res = await client.api.tasks[':id'].activity.$get({
        param: { id },
      })
      if (!res.ok) return fail(command, await toApiError(res))
      printJson(await res.json())
    })

  addSchemaOptions(
    task
      .command('search [query]')
      .description('Search tasks')
      .option('--full', 'Include full task description in the output'),
    listTasksQuerySchema,
    // hasEstimate/hasDue/includeAncestors unwrap to a raw ZodString (their
    // pre-transform type), so addSchemaOptions would expose them but without
    // true/false validation (any string round-trips through the
    // 'v === "true"' transform silently). Excluded until that gets its own
    // stricter boolean flag type. `q` is excluded since it's handled via the
    // positional query argument below.
    ['q', 'hasEstimate', 'hasDue', 'includeAncestors'],
  )
    .match(
      (command) => command,
      (error) => fail(task, error),
    )
    .action(
      async (
        query: string | undefined,
        options: Record<string, unknown> & { full?: boolean },
        command: Command,
      ) => {
        const client = buildClient(command, fetchImpl).match(
          (value) => value,
          (error) => fail(command, error),
        )
        const fields = {
          limit: 20,
          ...pickSchemaFields(listTasksQuerySchema, options, [
            'q',
            'hasEstimate',
            'hasDue',
            'includeAncestors',
          ]).match(
            (value) => value,
            (error) => fail(command, error),
          ),
          ...(query !== undefined ? { q: query } : {}),
        }
        const searchQuery: SearchQuery = toQuery(fields)
        const res = await client.api.tasks.$get({ query: searchQuery })
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- the route only declares a 200 response, so `res.ok` is always true at the type level; kept as a defense against status codes (e.g. from a proxy in front of the API) the client types don't know about
        if (!res.ok) return fail(command, await toApiError(res))
        printJsonList(await res.json(), 'description', { full: options.full })
      },
    )

  task
    .command('from-github <url>')
    .description('Create a task from a GitHub issue or pull request URL')
    .action(async (url: string, _options: unknown, command: Command) => {
      const client = buildClient(command, fetchImpl).match(
        (value) => value,
        (error) => fail(command, error),
      )
      const json: FromGithubJson = { url }
      const res = await client.api.tasks['from-github'].$post({ json })
      if (!res.ok) return fail(command, await toApiError(res))
      printJson(await res.json())
    })
}
