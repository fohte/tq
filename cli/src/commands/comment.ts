import {
  createCommentSchema,
  updateCommentSchema,
} from 'api/schemas/task-comment'
import type { Command } from 'commander'
import type { InferRequestType } from 'hono/client'

import type { Client } from '#client'
import { toApiError } from '#client'
import { buildClient } from '#command-context'
import type { ReadableStdin } from '#input'
import { readContentInput } from '#input'
import { printJson, printJsonList, printLinkSync } from '#output'
import { fail } from '#result'
import { addSchemaOptions } from '#schema-options'

type CreateCommentJson = InferRequestType<
  Client['api']['tasks'][':taskId']['comments']['$post']
>['json']

type UpdateCommentJson = InferRequestType<
  Client['api']['tasks'][':taskId']['comments'][':commentId']['$patch']
>['json']

interface ContentOptions extends Record<string, unknown> {
  file?: string
}

export function registerCommentCommands(
  program: Command,
  fetchImpl: typeof fetch,
  stdin: ReadableStdin,
): void {
  const comment = program.command('comment').description('Manage comments')

  comment
    .command('list <taskId>')
    .description('List comments for a task')
    .option('--full', 'Include full comment content in the output')
    .action(
      async (taskId: string, options: { full?: boolean }, command: Command) => {
        const client = buildClient(command, fetchImpl).match(
          (value) => value,
          (error) => fail(command, error),
        )
        const res = await client.api.tasks[':taskId'].comments.$get({
          param: { taskId },
        })
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- the route only declares a 200 response, so `res.ok` is always true at the type level; kept as a defense against status codes (e.g. from a proxy in front of the API) the client types don't know about
        if (!res.ok) return fail(command, await toApiError(res))
        printJsonList(await res.json(), 'content', { full: options.full })
      },
    )

  addSchemaOptions(
    comment
      .command('create <taskId>')
      .description('Create a comment')
      .option('--file <path>', 'Read content from a file instead of stdin'),
    createCommentSchema,
    ['content'],
  )
    .match(
      (cmd) => cmd,
      (error) => fail(comment, error),
    )
    .action(
      async (taskId: string, options: ContentOptions, command: Command) => {
        const client = buildClient(command, fetchImpl).match(
          (value) => value,
          (error) => fail(command, error),
        )
        const content = await readContentInput(options.file, stdin).match(
          (value) => value,
          (error) => fail(command, error),
        )
        if (content === undefined) {
          return fail(
            command,
            new Error(
              'Comment content is required. Provide --file <path> or pipe content via stdin.',
            ),
          )
        }

        const json: CreateCommentJson = { content }

        const res = await client.api.tasks[':taskId'].comments.$post({
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
    comment
      .command('update <taskId> <commentId>')
      .description('Update a comment')
      .option('--file <path>', 'Read content from a file instead of stdin'),
    updateCommentSchema,
    ['content'],
  )
    .match(
      (cmd) => cmd,
      (error) => fail(comment, error),
    )
    .action(
      async (
        taskId: string,
        commentId: string,
        options: ContentOptions,
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
        if (content === undefined) {
          return fail(
            command,
            new Error(
              'Comment content is required. Provide --file <path> or pipe content via stdin.',
            ),
          )
        }

        const json: UpdateCommentJson = { content }

        const res = await client.api.tasks[':taskId'].comments[
          ':commentId'
        ].$patch({
          param: { taskId, commentId },
          json,
        })
        if (!res.ok) return fail(command, await toApiError(res))
        const body = await res.json()
        printJson(body)
        printLinkSync(body.linkSync)
      },
    )

  comment
    .command('delete <taskId> <commentId>')
    .description('Delete a comment')
    .action(
      async (
        taskId: string,
        commentId: string,
        _options: unknown,
        command: Command,
      ) => {
        const client = buildClient(command, fetchImpl).match(
          (value) => value,
          (error) => fail(command, error),
        )
        const res = await client.api.tasks[':taskId'].comments[
          ':commentId'
        ].$delete({
          param: { taskId, commentId },
        })
        if (!res.ok) return fail(command, await toApiError(res))
        printJson({ deleted: true, taskId, commentId })
      },
    )
}
