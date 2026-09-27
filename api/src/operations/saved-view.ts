import { z } from 'zod'

import { encodePathSegment, pathSegmentSchema } from '#operations/path-segment'
import {
  defineOperation,
  requestJson,
  requestNoContent,
} from '#operations/types'
import {
  createSavedViewSchema,
  listSavedViewsQuerySchema,
  updateSavedViewSchema,
} from '#schemas/saved-view'

const savedViewId = pathSegmentSchema('Saved view ID')
const savedViewIdSchema = z.object({ id: savedViewId })
const updateSavedViewInputSchema = updateSavedViewSchema.extend({
  id: savedViewId,
})

export const savedViewOperations = [
  defineOperation(listSavedViewsQuerySchema, {
    path: ['saved-view', 'list'],
    description: 'List saved views',
    positionalArgs: [],
    kind: 'read',
    routes: ['GET /api/saved-views'],
    cli: {
      group: { description: 'Manage saved views', order: 4 },
      envDefaults: { context: 'TQ_CONTEXT' },
      output: { kind: 'json' },
    },
    run: (client, query) =>
      requestJson(client.api['saved-views'].$get({ query })),
  }),
  defineOperation(savedViewIdSchema, {
    path: ['saved-view', 'get'],
    description: 'Get a saved view',
    positionalArgs: ['id'],
    kind: 'read',
    routes: ['GET /api/saved-views/:id'],
    cli: { output: { kind: 'json' } },
    run: (client, { id }) =>
      requestJson(
        client.api['saved-views'][':id'].$get({
          param: { id: encodePathSegment(id) },
        }),
      ),
  }),
  defineOperation(createSavedViewSchema, {
    path: ['saved-view', 'create'],
    description: 'Create a saved view',
    positionalArgs: ['name', 'query'],
    kind: 'write',
    routes: ['POST /api/saved-views'],
    cli: {
      envDefaults: { context: 'TQ_CONTEXT' },
      output: { kind: 'json' },
    },
    run: (client, json) =>
      requestJson(client.api['saved-views'].$post({ json })),
  }),
  defineOperation(updateSavedViewInputSchema, {
    path: ['saved-view', 'update'],
    description: 'Update a saved view',
    positionalArgs: ['id'],
    kind: 'write',
    routes: ['PATCH /api/saved-views/:id'],
    cli: { output: { kind: 'json' } },
    run: (client, { id, ...json }) =>
      requestJson(
        client.api['saved-views'][':id'].$patch({
          param: { id: encodePathSegment(id) },
          json,
        }),
      ),
  }),
  defineOperation(savedViewIdSchema, {
    path: ['saved-view', 'delete'],
    description: 'Delete a saved view',
    positionalArgs: ['id'],
    kind: 'delete',
    routes: ['DELETE /api/saved-views/:id'],
    cli: { output: { kind: 'json' } },
    run: (client, { id }) =>
      requestNoContent(
        client.api['saved-views'][':id'].$delete({
          param: { id: encodePathSegment(id) },
        }),
      ).map(() => ({ deleted: true, id })),
  }),
] as const
