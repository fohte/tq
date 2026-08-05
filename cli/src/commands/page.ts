import { Command, InvalidArgumentError, Option } from 'commander'
import type { InferRequestType } from 'hono/client'

import type { Client } from '#client'
import { createClient, toApiError } from '#client'
import type { ReadableStdin } from '#input'
import { readContentInput } from '#input'
import { printJson, writeContentFile } from '#output'

type CreatePageJson = InferRequestType<
  Client['api']['tasks'][':taskId']['pages']['$post']
>['json']

type UpdatePageJson = InferRequestType<
  Client['api']['tasks'][':taskId']['pages'][':pageId']['$patch']
>['json']

interface GlobalOptions {
  apiUrl?: string
  header: Record<string, string>
}

interface CreateOptions {
  file?: string
  format?: 'markdown' | 'html'
  sortOrder?: number
}

interface UpdateOptions {
  title?: string
  file?: string
  format?: 'markdown' | 'html'
  sortOrder?: number
}

function resolveApiUrl(options: GlobalOptions): string {
  if (options.apiUrl != null && options.apiUrl.length > 0) {
    return options.apiUrl
  }
  throw new Error(
    'API URL is not set. Pass --api-url or set the TQ_API_URL environment variable.',
  )
}

function buildClient(command: Command, fetchImpl: typeof fetch): Client {
  const options = command.optsWithGlobals<GlobalOptions>()
  const apiUrl = resolveApiUrl(options)
  return createClient({ apiUrl, headers: options.header }, fetchImpl)
}

function parseSortOrder(value: string): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) {
    throw new InvalidArgumentError(`Expected an integer, got: ${value}`)
  }
  return parsed
}

function addFormatOption(command: Command): Command {
  return command.addOption(
    new Option('--format <format>', 'Content format').choices([
      'markdown',
      'html',
    ]),
  )
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
    .action(async (taskId: string, _options: unknown, command: Command) => {
      const client = buildClient(command, fetchImpl)
      const res = await client.api.tasks[':taskId'].pages.$get({
        param: { taskId },
      })
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- the route only declares a 200 response, so `res.ok` is always true at the type level; kept as a defense against status codes (e.g. from a proxy in front of the API) the client types don't know about
      if (!res.ok) throw await toApiError(res)
      printJson(await res.json())
    })

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

  addFormatOption(
    page
      .command('create <taskId> <title>')
      .description('Create a page')
      .option('--file <path>', 'Read content from a file instead of stdin'),
  )
    .option('--sort-order <n>', 'Sort order', parseSortOrder)
    .action(
      async (
        taskId: string,
        title: string,
        options: CreateOptions,
        command: Command,
      ) => {
        const client = buildClient(command, fetchImpl)
        const content = await readContentInput(options.file, stdin)

        const json: CreatePageJson = { title }
        if (content !== undefined) json.content = content
        if (options.format !== undefined) json.format = options.format
        if (options.sortOrder !== undefined) {
          json.sortOrder = options.sortOrder
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

  addFormatOption(
    page
      .command('update <taskId> <pageId>')
      .description('Update a page')
      .option('--title <title>', 'New title')
      .option('--file <path>', 'Read content from a file instead of stdin'),
  )
    .option('--sort-order <n>', 'Sort order', parseSortOrder)
    .action(
      async (
        taskId: string,
        pageId: string,
        options: UpdateOptions,
        command: Command,
      ) => {
        const client = buildClient(command, fetchImpl)
        const content = await readContentInput(options.file, stdin)

        const json: UpdatePageJson = {}
        if (options.title !== undefined) json.title = options.title
        if (content !== undefined) json.content = content
        if (options.format !== undefined) json.format = options.format
        if (options.sortOrder !== undefined) {
          json.sortOrder = options.sortOrder
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
