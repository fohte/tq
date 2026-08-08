import { createPageSchema, updatePageSchema } from 'api/schemas/task-page'
import type { Command } from 'commander'
import type { InferRequestType } from 'hono/client'

import type { Client } from '#client'
import { toApiError } from '#client'
import { buildClient } from '#command-context'
import type { ReadableStdin } from '#input'
import { readContentInput } from '#input'
import { printJson, printJsonList, writeContentFile } from '#output'
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
        const client = buildClient(command, fetchImpl)
        const res = await client.api.tasks[':taskId'].pages.$get({
          param: { taskId },
        })
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- the route only declares a 200 response, so `res.ok` is always true at the type level; kept as a defense against status codes (e.g. from a proxy in front of the API) the client types don't know about
        if (!res.ok) throw await toApiError(res)
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
        const client = buildClient(command, fetchImpl)
        const res = await client.api.tasks[':taskId'].pages[':pageId'].$get({
          param: { taskId, pageId },
        })
        if (!res.ok) throw await toApiError(res)
        const page = await res.json()

        if (options.output != null) {
          const { content, ...metadata } = page
          await writeContentFile(options.output, content)
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
  ).action(
    async (
      taskId: string,
      title: string,
      options: CreateOptions,
      command: Command,
    ) => {
      const client = buildClient(command, fetchImpl)
      const content = await readContentInput(options.file, stdin)

      const json: CreatePageJson = {
        ...pickSchemaFields(createPageSchema, options, ['content']),
        title,
        ...(content !== undefined ? { content } : {}),
      }

      const res = await client.api.tasks[':taskId'].pages.$post({
        param: { taskId },
        json,
      })
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- the route only declares a 201 response, so `res.ok` is always true at the type level; kept as a defense against status codes (e.g. from a proxy in front of the API) the client types don't know about
      if (!res.ok) throw await toApiError(res)
      printJson(await res.json())
    },
  )

  addSchemaOptions(
    page
      .command('update <taskId> <pageId>')
      .description('Update a page')
      .option('--file <path>', 'Read content from a file instead of stdin'),
    updatePageSchema,
    ['content'],
  ).action(
    async (
      taskId: string,
      pageId: string,
      options: UpdateOptions,
      command: Command,
    ) => {
      const client = buildClient(command, fetchImpl)
      const content = await readContentInput(options.file, stdin)

      const json: UpdatePageJson = {
        ...pickSchemaFields(updatePageSchema, options, ['content']),
        ...(content !== undefined ? { content } : {}),
      }

      const res = await client.api.tasks[':taskId'].pages[':pageId'].$patch({
        param: { taskId, pageId },
        json,
      })
      if (!res.ok) throw await toApiError(res)
      printJson(await res.json())
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
        const client = buildClient(command, fetchImpl)
        const res = await client.api.tasks[':taskId'].pages[':pageId'].$delete({
          param: { taskId, pageId },
        })
        if (!res.ok) throw await toApiError(res)
        printJson({ deleted: true, taskId, pageId })
      },
    )
}
