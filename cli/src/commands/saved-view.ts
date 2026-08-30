import {
  createSavedViewSchema,
  listSavedViewsQuerySchema,
  updateSavedViewSchema,
} from 'api/schemas/saved-view'
import type { Command } from 'commander'
import type { InferRequestType } from 'hono/client'

import type { Client } from '#client'
import { toApiError } from '#client'
import { buildClient } from '#command-context'
import { printJson } from '#output'
import { fail } from '#result'
import { addSchemaOptions, pickSchemaFields } from '#schema-options'

type ListSavedViewsQuery = InferRequestType<
  Client['api']['saved-views']['$get']
>['query']

type CreateSavedViewJson = InferRequestType<
  Client['api']['saved-views']['$post']
>['json']

type UpdateSavedViewJson = InferRequestType<
  Client['api']['saved-views'][':id']['$patch']
>['json']

export function registerSavedViewCommands(
  program: Command,
  fetchImpl: typeof fetch,
): void {
  const savedView = program
    .command('saved-view')
    .description('Manage saved views')

  addSchemaOptions(
    savedView.command('list').description('List saved views'),
    listSavedViewsQuerySchema,
    [],
    { context: 'TQ_CONTEXT' },
  )
    .match(
      (cmd) => cmd,
      (error) => fail(savedView, error),
    )
    .action(async (options: Record<string, unknown>, command: Command) => {
      const client = buildClient(command, fetchImpl).match(
        (value) => value,
        (error) => fail(command, error),
      )
      const query: ListSavedViewsQuery = pickSchemaFields(
        listSavedViewsQuerySchema,
        options,
      ).match(
        (value) => value,
        (error) => fail(command, error),
      )
      const res = await client.api['saved-views'].$get({ query })
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- the route only declares a 200 response, so `res.ok` is always true at the type level; kept as a defense against status codes (e.g. from a proxy in front of the API) the client types don't know about
      if (!res.ok) return fail(command, await toApiError(res))
      printJson(await res.json())
    })

  savedView
    .command('get <id>')
    .description('Get a saved view')
    .action(async (id: string, _options: unknown, command: Command) => {
      const client = buildClient(command, fetchImpl).match(
        (value) => value,
        (error) => fail(command, error),
      )
      const res = await client.api['saved-views'][':id'].$get({
        param: { id },
      })
      if (!res.ok) return fail(command, await toApiError(res))
      printJson(await res.json())
    })

  addSchemaOptions(
    savedView
      .command('create <name> <query>')
      .description('Create a saved view'),
    createSavedViewSchema,
    ['name', 'query'],
    { context: 'TQ_CONTEXT' },
  )
    .match(
      (cmd) => cmd,
      (error) => fail(savedView, error),
    )
    .action(
      async (
        name: string,
        query: string,
        options: Record<string, unknown>,
        command: Command,
      ) => {
        const client = buildClient(command, fetchImpl).match(
          (value) => value,
          (error) => fail(command, error),
        )
        const json: CreateSavedViewJson = {
          ...pickSchemaFields(createSavedViewSchema, options, [
            'name',
            'query',
          ]).match(
            (value) => value,
            (error) => fail(command, error),
          ),
          name,
          query,
        }
        const res = await client.api['saved-views'].$post({ json })
        if (!res.ok) return fail(command, await toApiError(res))
        printJson(await res.json())
      },
    )

  addSchemaOptions(
    savedView.command('update <id>').description('Update a saved view'),
    updateSavedViewSchema,
  )
    .match(
      (cmd) => cmd,
      (error) => fail(savedView, error),
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
        const json: UpdateSavedViewJson = pickSchemaFields(
          updateSavedViewSchema,
          options,
        ).match(
          (value) => value,
          (error) => fail(command, error),
        )
        const res = await client.api['saved-views'][':id'].$patch({
          param: { id },
          json,
        })
        if (!res.ok) return fail(command, await toApiError(res))
        printJson(await res.json())
      },
    )

  savedView
    .command('delete <id>')
    .description('Delete a saved view')
    .action(async (id: string, _options: unknown, command: Command) => {
      const client = buildClient(command, fetchImpl).match(
        (value) => value,
        (error) => fail(command, error),
      )
      const res = await client.api['saved-views'][':id'].$delete({
        param: { id },
      })
      if (!res.ok) return fail(command, await toApiError(res))
      printJson({ deleted: true, id })
    })
}
