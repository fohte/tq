import type { Command } from 'commander'
import type { InferRequestType } from 'hono/client'

import type { Client } from '#client'
import { toApiError } from '#client'
import { buildClient } from '#command-context'
import { printJson } from '#output'
import { fail } from '#result'

type EventsQuery = InferRequestType<
  Client['api']['calendar']['events']['$get']
>['query']

export function registerCalendarCommands(
  program: Command,
  fetchImpl: typeof fetch,
): void {
  const calendar = program
    .command('calendar')
    .description('Manage calendar events')

  calendar
    .command('events <timeMin> <timeMax>')
    .description('List calendar events between two ISO 8601 timestamps')
    .action(
      async (
        timeMin: string,
        timeMax: string,
        _options: unknown,
        command: Command,
      ) => {
        const client = buildClient(command, fetchImpl).match(
          (value) => value,
          (error) => fail(command, error),
        )
        const query: EventsQuery = { timeMin, timeMax }
        const res = await client.api.calendar.events.$get({ query })
        if (!res.ok) return fail(command, await toApiError(res))
        printJson(await res.json())
      },
    )
}
