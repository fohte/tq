import { errAsync } from 'neverthrow'

import { defineOperation, requestJson } from '#operations/types'
import { memoContextParamsSchema, updateMemoSchema } from '#schemas/memo'

const memoContextSchema = memoContextParamsSchema.extend({
  context: memoContextParamsSchema.shape.context.optional(),
})
const updateMemoInputSchema = memoContextSchema.extend({
  content: updateMemoSchema.shape.content,
  revision: updateMemoSchema.shape.revision.optional(),
})

export const memoOperations = [
  defineOperation(memoContextSchema, {
    path: ['memo', 'get'],
    description:
      'Get the markdown memo for a context. An empty context starts at revision 0.',
    positionalArgs: [],
    mcpInputSchema: memoContextParamsSchema,
    kind: 'read',
    routes: ['GET /api/memos/:context'],
    cli: {
      group: { description: 'Manage context memos', order: 17 },
      envDefaults: { context: 'TQ_CONTEXT' },
      output: { kind: 'json' },
    },
    run: (client, { context }) => {
      if (context === undefined) {
        return errAsync({ kind: 'input', message: 'context is required' })
      }

      return requestJson(
        client.api.memos[':context'].$get({ param: { context } }),
      )
    },
  }),
  defineOperation(updateMemoInputSchema, {
    path: ['memo', 'update'],
    description:
      'Replace the markdown memo for a context. Use the current revision; a stale revision returns a conflict without changing the memo.',
    positionalArgs: [],
    mcpInputSchema: memoContextParamsSchema.extend(updateMemoSchema.shape),
    kind: 'write',
    routes: ['PUT /api/memos/:context'],
    cli: {
      contentInput: { field: 'content' },
      envDefaults: { context: 'TQ_CONTEXT' },
      output: { kind: 'json' },
    },
    run: (client, { context, content, revision }) => {
      if (context === undefined || revision === undefined) {
        return errAsync({
          kind: 'input',
          message: 'context and revision are required',
        })
      }

      return requestJson(
        client.api.memos[':context'].$put({
          param: { context },
          json: { content, revision },
        }),
      )
    },
  }),
] as const
