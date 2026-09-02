import { updateLabelSchema } from 'api/schemas/label'
import type { Command } from 'commander'
import type { InferRequestType } from 'hono/client'

import type { Client } from '#client'
import { toApiError } from '#client'
import { buildClient } from '#command-context'
import { printJson } from '#output'
import { fail } from '#result'
import { addSchemaOptions, pickSchemaFields } from '#schema-options'

type UpdateLabelJson = InferRequestType<
  Client['api']['labels'][':id']['$patch']
>['json']

export function registerLabelCommands(
  program: Command,
  fetchImpl: typeof fetch,
): void {
  const label = program.command('label').description('Manage labels')

  label
    .command('list')
    .description('List labels')
    .action(async (_options: unknown, command: Command) => {
      const client = buildClient(command, fetchImpl).match(
        (value) => value,
        (error) => fail(command, error),
      )
      const res = await client.api.labels.$get({ query: {} })
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- the route only declares a 200 response, so `res.ok` is always true at the type level; kept as a defense against status codes (e.g. from a proxy in front of the API) the client types don't know about
      if (!res.ok) return fail(command, await toApiError(res))
      printJson(await res.json())
    })

  addSchemaOptions(
    label.command('update <id>').description('Update a label'),
    updateLabelSchema,
  )
    .match(
      (cmd) => cmd,
      (error) => fail(label, error),
    )
    .action(
      async (
        id: string,
        options: Record<string, unknown>,
        command: Command,
      ) => {
        const client = buildClient(command, fetchImpl).match(
          (value) => value,
          (error) => fail(command, error),
        )
        const json: UpdateLabelJson = pickSchemaFields(
          updateLabelSchema,
          options,
        ).match(
          (value) => value,
          (error) => fail(command, error),
        )
        const res = await client.api.labels[':id'].$patch({
          param: { id },
          json,
        })
        if (!res.ok) return fail(command, await toApiError(res))
        printJson(await res.json())
      },
    )

  label
    .command('delete <id>')
    .description('Delete a label')
    .action(async (id: string, _options: unknown, command: Command) => {
      const client = buildClient(command, fetchImpl).match(
        (value) => value,
        (error) => fail(command, error),
      )
      const res = await client.api.labels[':id'].$delete({
        param: { id },
      })
      if (!res.ok) return fail(command, await toApiError(res))
      printJson({ deleted: true, id })
    })
}
