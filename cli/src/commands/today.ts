import type { Command } from 'commander'
import type { InferRequestType } from 'hono/client'

import type { Client } from '#client'
import { toApiError } from '#client'
import { buildClient } from '#command-context'
import { printJson } from '#output'
import { fail } from '#result'

type TodayTasksQuery = InferRequestType<
  Client['api']['schedule']['today-tasks']['$get']
>['query']

type SetTodayTasksJson = InferRequestType<
  Client['api']['schedule']['today-tasks']['$put']
>['json']

export function registerTodayCommands(
  program: Command,
  fetchImpl: typeof fetch,
): void {
  const today = program.command('today').description("Manage today's tasks")

  today
    .command('get <date>')
    .description('List today-tasks for a date (YYYY-MM-DD)')
    .action(async (date: string, _options: unknown, command: Command) => {
      const client = buildClient(command, fetchImpl).match(
        (value) => value,
        (error) => fail(command, error),
      )
      const query: TodayTasksQuery = { date }
      const res = await client.api.schedule['today-tasks'].$get({ query })
      if (!res.ok) return fail(command, await toApiError(res))
      printJson(await res.json())
    })

  today
    .command('set <date> [taskIds...]')
    .description(
      'Replace the today-task list for a date (YYYY-MM-DD) with the given task UUIDs, in order',
    )
    .action(
      async (
        date: string,
        taskIds: string[] = [],
        _options: unknown,
        command: Command,
      ) => {
        const client = buildClient(command, fetchImpl).match(
          (value) => value,
          (error) => fail(command, error),
        )
        const json: SetTodayTasksJson = { date, taskIds }
        const res = await client.api.schedule['today-tasks'].$put({ json })
        if (!res.ok) return fail(command, await toApiError(res))
        printJson(await res.json())
      },
    )
}
