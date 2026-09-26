import { listTasksQuerySchema } from 'api/schemas/task'
import type { Command } from 'commander'
import type { InferRequestType } from 'hono/client'

import type { Client } from '#client'
import { toApiError } from '#client'
import { buildClient, resolveWebUrl } from '#command-context'
import { printJson, printJsonList } from '#output'
import { fail } from '#result'
import { addSchemaOptions, pickSchemaFields } from '#schema-options'

type ListTasksQuery = InferRequestType<Client['api']['tasks']['$get']>['query']
type SearchQuery = InferRequestType<Client['api']['tasks']['$get']>['query']

// hono's client types every query field as `string | string[] | undefined`
// regardless of the underlying zod schema, so numbers/enums picked from the
// schema (real types) must be stringified before being sent as a query.
function toQuery(fields: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, String(value)]),
  )
}

export function registerTaskListCommand(
  task: Command,
  fetchImpl: typeof fetch,
): void {
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
    { context: 'TQ_CONTEXT' },
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
}

export function registerTaskGetCommand(
  task: Command,
  fetchImpl: typeof fetch,
): void {
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
}

export function registerTaskUrlCommand(task: Command): void {
  task
    .command('url <id>')
    .description("Print a task's web URL")
    .action((id: string, _options: unknown, command: Command) => {
      const webUrl = resolveWebUrl(command).match(
        (value) => value,
        (error) => fail(command, error),
      )
      process.stdout.write(`${webUrl}/tasks/${id}\n`)
    })
}

export function registerTaskActivityCommand(
  task: Command,
  fetchImpl: typeof fetch,
): void {
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
}

export function registerTaskSearchCommand(
  task: Command,
  fetchImpl: typeof fetch,
): void {
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
    { context: 'TQ_CONTEXT' },
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
}

export function registerTaskSessionsCommand(
  task: Command,
  fetchImpl: typeof fetch,
): void {
  task
    .command('sessions <id>')
    .description('List agent sessions linked to a task')
    .action(async (id: string, _options: unknown, command: Command) => {
      const client = buildClient(command, fetchImpl).match(
        (value) => value,
        (error) => fail(command, error),
      )
      const res = await client.api.tasks[':taskId']['agent-sessions'].$get({
        param: { taskId: id },
      })
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- the route only declares a 200 response, so `res.ok` is always true at the type level; kept as a defense against status codes (e.g. from a proxy in front of the API) the client types don't know about
      if (!res.ok) return fail(command, await toApiError(res))
      printJson(await res.json())
    })
}
