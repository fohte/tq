import { errAsync, okAsync } from 'neverthrow'
import { z } from 'zod'

import { ALLOWED_CONTENT_TYPES } from '#constants/assets'
import { encodePathSegment, pathSegmentSchema } from '#operations/path-segment'
import {
  defineOperation,
  requestJson,
  requestNoContent,
} from '#operations/types'

const assetIdSchema = z.object({ id: pathSegmentSchema('Asset ID') })
const assetUploadSchema = z.object({
  filePath: z.string(),
  file: z.instanceof(File),
})
const assetUploadResponseSchema = z.looseObject({ id: z.string() })
const assetGetResponseSchema = z.object({ url: z.string() })

const EXTENSION_CONTENT_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
} as const

function escapeMarkdownAlt(text: string): string {
  return text
    .replaceAll('\\', '\\\\')
    .replaceAll('[', '\\[')
    .replaceAll(']', '\\]')
}

export const assetOperations = [
  defineOperation(assetUploadSchema, {
    path: ['asset', 'upload'],
    description: 'Upload an asset',
    positionalArgs: ['filePath'],
    kind: 'write',
    surface: {
      only: 'cli',
      reason:
        'The command reads a local file, which the MCP interface cannot provide as multipart input.',
    },
    routes: ['POST /api/assets'],
    cli: {
      fileInput: {
        field: 'file',
        pathField: 'filePath',
        contentTypes: EXTENSION_CONTENT_TYPES,
        allowedContentTypes: ALLOWED_CONTENT_TYPES,
      },
      output: { kind: 'json' },
    },
    run: (client, { file }) =>
      requestJson(client.api.assets.$post({ form: { file } })).andThen(
        (response) => {
          const uploaded = assetUploadResponseSchema.safeParse(response)
          if (!uploaded.success) {
            return errAsync({
              kind: 'request' as const,
              error: new Error('Invalid asset upload response.'),
            })
          }
          return okAsync({
            ...uploaded.data,
            markdown: `![${escapeMarkdownAlt(file.name)}](/api/assets/${uploaded.data.id})`,
          })
        },
      ),
  }),
  defineOperation(assetIdSchema, {
    path: ['asset', 'get'],
    description:
      'Get an asset (prints its signed URL, or downloads it with --output)',
    positionalArgs: ['id'],
    kind: 'read',
    surface: {
      only: 'cli',
      reason:
        'The command can download binary data to a local file, which the MCP interface cannot write.',
    },
    routes: ['GET /api/assets/:id'],
    cli: {
      output: {
        kind: 'json',
        fields: ['url'],
        fileOutput: {
          kind: 'binary',
          option: {
            name: 'output',
            description:
              'Download the asset to a file instead of printing its URL',
          },
          urlField: 'url',
          summaryFields: ['id'],
          outputPathField: 'output',
        },
      },
    },
    run: (client, { id }) =>
      requestJson(
        client.api.assets[':id'].$get({
          param: { id: encodePathSegment(id) },
        }),
      ).andThen((response) => {
        const asset = assetGetResponseSchema.safeParse(response)
        if (!asset.success) {
          return errAsync({
            kind: 'request' as const,
            error: new Error('Invalid asset get response.'),
          })
        }
        return okAsync({ ...asset.data, id })
      }),
  }),
  defineOperation(assetIdSchema, {
    path: ['asset', 'delete'],
    description: 'Delete an asset',
    positionalArgs: ['id'],
    kind: 'delete',
    routes: ['DELETE /api/assets/:id'],
    cli: { output: { kind: 'json' } },
    run: (client, { id }) =>
      requestNoContent(
        client.api.assets[':id'].$delete({
          param: { id: encodePathSegment(id) },
        }),
      ).map(() => ({ deleted: true, id })),
  }),
] as const
