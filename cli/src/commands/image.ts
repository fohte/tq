import { basename, extname } from 'node:path'

import { ALLOWED_CONTENT_TYPES } from 'api/constants/images'
import type { Command } from 'commander'

import { toApiError } from '#client'
import { buildClient } from '#command-context'
import { readBinaryFile } from '#input'
import { printJson, writeBinaryFile } from '#output'

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

function detectContentType(filePath: string): string {
  const contentType = EXTENSION_CONTENT_TYPES[extname(filePath).toLowerCase()]
  if (contentType == null) {
    throw new Error(
      `Unsupported file extension for ${filePath}. Allowed types: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
    )
  }
  return contentType
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
      const client = buildClient(command, fetchImpl)
      const data = await readBinaryFile(filePath)
      const file = new File([data], basename(filePath), {
        type: detectContentType(filePath),
      })

      const res = await client.api.images.$post({ form: { file } })
      if (!res.ok) throw await toApiError(res)
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
        const client = buildClient(command, fetchImpl)
        const res = await client.api.images[':id'].$get({ param: { id } })
        if (!res.ok) throw await toApiError(res)
        const { url } = await res.json()

        if (options.output != null) {
          const download = await fetchImpl(url)
          if (!download.ok) throw await toApiError(download)
          await writeBinaryFile(
            options.output,
            new Uint8Array(await download.arrayBuffer()),
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
      const client = buildClient(command, fetchImpl)
      const res = await client.api.images[':id'].$delete({ param: { id } })
      if (!res.ok) throw await toApiError(res)
      printJson({ deleted: true, id })
    })
}
