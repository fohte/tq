import { createPageSchema, updatePageSchema } from 'api/schemas/task-page'
import type { Command } from 'commander'
import type { InferRequestType } from 'hono/client'

import type { Client } from '#client'
import { toApiError } from '#client'
import { buildClient } from '#command-context'
import type { ReadableStdin } from '#input'
import { readContentInput } from '#input'
import {
  printJson,
  printJsonList,
  printLinkSync,
  writeContentFile,
} from '#output'
import { fail } from '#result'
import { addSchemaOptions, pickSchemaFields } from '#schema-options'

type CreatePageJson = InferRequestType<
  Client['api']['tasks'][':taskId']['pages']['$post']
>['json']

type UpdatePageJson = InferRequestType<
  Client['api']['tasks'][':taskId']['pages'][':pageId']['$patch']
>['json']

interface CreateOptions extends Record<string, unknown> {
  file?: string
}

interface UpdateOptions extends Record<string, unknown> {
  file?: string
}

export function registerPageCommands(
  program: Command,
  fetchImpl: typeof fetch,
  stdin: ReadableStdin,
): void {
  const page = program.command('page').description('Manage task pages')

  page
    .command('list <taskId>')
    .description('List pages for a task')
    .option('--full', 'Include full page content in the output')
    .action(
      async (taskId: string, options: { full?: boolean }, command: Command) => {
        const client = buildClient(command, fetchImpl).match(
          (value) => value,
          (error) => fail(command, error),
        )
        const res = await client.api.tasks[':taskId'].pages.$get({
          param: { taskId },
        })
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- the route only declares a 200 response, so `res.ok` is always true at the type level; kept as a defense against status codes (e.g. from a proxy in front of the API) the client types don't know about
        if (!res.ok) return fail(command, await toApiError(res))
        printJsonList(await res.json(), 'content', { full: options.full })
      },
    )

  page
    .command('get <taskId> <pageId>')
    .description('Get a page')
    .option(
      '--output <path>',
      'Write the page content to a file instead of stdout',
    )
    .action(
      async (
        taskId: string,
        pageId: string,
        options: { output?: string },
        command: Command,
      ) => {
        const client = buildClient(command, fetchImpl).match(
          (value) => value,
          (error) => fail(command, error),
        )
        const res = await client.api.tasks[':taskId'].pages[':pageId'].$get({
          param: { taskId, pageId },
        })
        if (!res.ok) return fail(command, await toApiError(res))
        const page = await res.json()

        if (options.output != null) {
          const { content, ...metadata } = page
          await writeContentFile(options.output, content).match(
            (value) => value,
            (error) => fail(command, error),
          )
          printJson(metadata)
          return
        }

        printJson(page)
      },
    )

  addSchemaOptions(
    page
      .command('create <taskId> <title>')
      .description('Create a page')
      .option('--file <path>', 'Read content from a file instead of stdin'),
    createPageSchema,
    ['content'],
  )
    .match(
      (cmd) => cmd,
      (error) => fail(page, error),
    )
    .action(
      async (
        taskId: string,
        title: string,
        options: CreateOptions,
        command: Command,
      ) => {
        const client = buildClient(command, fetchImpl).match(
          (value) => value,
          (error) => fail(command, error),
        )
        const content = await readContentInput(options.file, stdin).match(
          (value) => value,
          (error) => fail(command, error),
        )

        const json: CreatePageJson = {
          ...pickSchemaFields(createPageSchema, options, ['content']).match(
            (value) => value,
            (error) => fail(command, error),
          ),
          title,
          ...(content !== undefined ? { content } : {}),
        }

        const res = await client.api.tasks[':taskId'].pages.$post({
          param: { taskId },
          json,
        })
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- the route only declares a 201 response, so `res.ok` is always true at the type level; kept as a defense against status codes (e.g. from a proxy in front of the API) the client types don't know about
        if (!res.ok) return fail(command, await toApiError(res))
        const body = await res.json()
        printJson(body)
        printLinkSync(body.linkSync)
      },
    )

  addSchemaOptions(
    page
      .command('update <taskId> <pageId>')
      .description('Update a page')
      .option('--file <path>', 'Read content from a file instead of stdin'),
    updatePageSchema,
    ['content'],
  )
    .match(
      (cmd) => cmd,
      (error) => fail(page, error),
    )
    .action(
      async (
        taskId: string,
        pageId: string,
        options: UpdateOptions,
        command: Command,
      ) => {
        const client = buildClient(command, fetchImpl).match(
          (value) => value,
          (error) => fail(command, error),
        )
        const content = await readContentInput(options.file, stdin).match(
          (value) => value,
          (error) => fail(command, error),
        )

        const json: UpdatePageJson = {
          ...pickSchemaFields(updatePageSchema, options, ['content']).match(
            (value) => value,
            (error) => fail(command, error),
          ),
          ...(content !== undefined ? { content } : {}),
        }

        const res = await client.api.tasks[':taskId'].pages[':pageId'].$patch({
          param: { taskId, pageId },
          json,
        })
        if (!res.ok) return fail(command, await toApiError(res))
        const body = await res.json()
        printJson(body)
        printLinkSync(body.linkSync)
      },
    )

  page
    .command('delete <taskId> <pageId>')
    .description('Delete a page')
    .action(
      async (
        taskId: string,
        pageId: string,
        _options: unknown,
        command: Command,
      ) => {
        const client = buildClient(command, fetchImpl).match(
          (value) => value,
          (error) => fail(command, error),
        )
        const res = await client.api.tasks[':taskId'].pages[':pageId'].$delete({
          param: { taskId, pageId },
        })
        if (!res.ok) return fail(command, await toApiError(res))
        printJson({ deleted: true, taskId, pageId })
      },
    )
}
