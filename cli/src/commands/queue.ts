import type { Command } from 'commander'
import type { InferRequestType } from 'hono/client'

import type { Client } from '#client'
import { toApiError } from '#client'
import { buildClient } from '#command-context'
import { printJson } from '#output'
import { fail } from '#result'

type QueueItemsQuery = InferRequestType<
  Client['api']['queues'][':key']['items']['$get']
>['query']

type SetQueueItemsJson = InferRequestType<
  Client['api']['queues'][':key']['items']['$put']
>['json']

export function registerQueueCommands(
  program: Command,
  fetchImpl: typeof fetch,
): void {
  const queue = program.command('queue').description('Manage task queues')

  queue
    .command('list')
    .description('List the available queues')
    .action(async (_options: unknown, command: Command) => {
      const client = buildClient(command, fetchImpl).match(
        (value) => value,
        (error) => fail(command, error),
      )
      const res = await client.api.queues.$get()
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- the route only declares a 200 response, so `res.ok` is always true at the type level; kept as a defense against status codes (e.g. from a proxy in front of the API) the client types don't know about
      if (!res.ok) return fail(command, await toApiError(res))
      printJson(await res.json())
    })

  queue
    .command('get <key> <date>')
    .description('List a queue for a date (YYYY-MM-DD)')
    .action(
      async (
        key: string,
        date: string,
        _options: unknown,
        command: Command,
      ) => {
        const client = buildClient(command, fetchImpl).match(
          (value) => value,
          (error) => fail(command, error),
        )
        const query: QueueItemsQuery = { date }
        const res = await client.api.queues[':key'].items.$get({
          param: { key },
          query,
        })
        if (!res.ok) return fail(command, await toApiError(res))
        printJson(await res.json())
      },
    )

  queue
    .command('set <key> <date> [taskIds...]')
    .description(
      'Replace a queue for a date (YYYY-MM-DD) with the given task UUIDs, in order',
    )
    .action(
      async (
        key: string,
        date: string,
        taskIds: string[] = [],
        _options: unknown,
        command: Command,
      ) => {
        const client = buildClient(command, fetchImpl).match(
          (value) => value,
          (error) => fail(command, error),
        )
        const json: SetQueueItemsJson = { date, taskIds }
        const res = await client.api.queues[':key'].items.$put({
          param: { key },
          json,
        })
        if (!res.ok) return fail(command, await toApiError(res))
        printJson(await res.json())
      },
    )
}
