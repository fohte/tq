import { basename, extname } from 'node:path'

import { ALLOWED_CONTENT_TYPES } from 'api/constants/images'
import type { Command } from 'commander'
import { err, ok, Result } from 'neverthrow'

import { toApiError } from '#client'
import { buildClient } from '#command-context'
import { readBinaryFile } from '#input'
import { printJson, writeBinaryFile } from '#output'
import { fail } from '#result'

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

function detectContentType(filePath: string): Result<string, Error> {
  const contentType = EXTENSION_CONTENT_TYPES[extname(filePath).toLowerCase()]
  if (contentType == null) {
    return err(
      new Error(
        `Unsupported file extension for ${filePath}. Allowed types: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
      ),
    )
  }
  return ok(contentType)
}

export function registerImageCommands(
  program: Command,
  fetchImpl: typeof fetch,
): void {
  const image = program.command('image').description('Manage images')

  image
    .command('upload <filePath>')
    .description('Upload an image')
    .action(async (filePath: string, _options: unknown, command: Command) => {
      const client = buildClient(command, fetchImpl).match(
        (value) => value,
        (error) => fail(command, error),
      )
      const data = await readBinaryFile(filePath).match(
        (value) => value,
        (error) => fail(command, error),
      )
      const file = new File([data], basename(filePath), {
        type: detectContentType(filePath).match(
          (value) => value,
          (error) => fail(command, error),
        ),
      })

      const res = await client.api.images.$post({ form: { file } })
      if (!res.ok) return fail(command, await toApiError(res))
      printJson(await res.json())
    })

  image
    .command('get <id>')
    .description(
      'Get an image (prints its signed URL, or downloads it with --output)',
    )
    .option(
      '--output <path>',
      'Download the image to a file instead of printing its URL',
    )
    .action(
      async (id: string, options: { output?: string }, command: Command) => {
        const client = buildClient(command, fetchImpl).match(
          (value) => value,
          (error) => fail(command, error),
        )
        const res = await client.api.images[':id'].$get({ param: { id } })
        if (!res.ok) return fail(command, await toApiError(res))
        const { url } = await res.json()

        if (options.output != null) {
          const download = await fetchImpl(url)
          if (!download.ok) return fail(command, await toApiError(download))
          await writeBinaryFile(
            options.output,
            new Uint8Array(await download.arrayBuffer()),
          ).match(
            (value) => value,
            (error) => fail(command, error),
          )
          printJson({ id, output: options.output })
          return
        }

        printJson({ url })
      },
    )

  image
    .command('delete <id>')
    .description('Delete an image')
    .action(async (id: string, _options: unknown, command: Command) => {
      const client = buildClient(command, fetchImpl).match(
        (value) => value,
        (error) => fail(command, error),
      )
      const res = await client.api.images[':id'].$delete({ param: { id } })
      if (!res.ok) return fail(command, await toApiError(res))
      printJson({ deleted: true, id })
    })
}
