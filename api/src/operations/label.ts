import { z } from 'zod'

import { encodePathSegment, pathSegmentSchema } from '#operations/path-segment'
import {
  defineOperation,
  requestJson,
  requestNoContent,
} from '#operations/types'
import { listLabelsQuerySchema, updateLabelSchema } from '#schemas/label'

const labelIdSchema = pathSegmentSchema('Label ID')
const updateLabelInputSchema = updateLabelSchema.extend({ id: labelIdSchema })
const deleteLabelInputSchema = z.object({ id: labelIdSchema })

export const labelOperations = [
  defineOperation(listLabelsQuerySchema, {
    path: ['label', 'list'],
    description:
      'List labels, optionally filtered by context. Use this to resolve label names before filtering tasks or attaching labels.',
    positionalArgs: [],
    kind: 'read',
    routes: ['GET /api/labels'],
    cli: { output: { kind: 'json' } },
    run: (client, { context }) =>
      requestJson(
        client.api.labels.$get({
          query: context == null ? {} : { context },
        }),
      ),
  }),
  defineOperation(updateLabelInputSchema, {
    path: ['label', 'update'],
    description: 'Update a label.',
    positionalArgs: ['id'],
    kind: 'write',
    routes: ['PATCH /api/labels/:id'],
    cli: { output: { kind: 'json' } },
    run: (client, { id, ...json }) =>
      requestJson(
        client.api.labels[':id'].$patch({
          param: { id: encodePathSegment(id) },
          json,
        }),
      ),
  }),
  defineOperation(deleteLabelInputSchema, {
    path: ['label', 'delete'],
    description: 'Delete a label.',
    positionalArgs: ['id'],
    kind: 'delete',
    routes: ['DELETE /api/labels/:id'],
    cli: { output: { kind: 'json' } },
    run: (client, { id }) =>
      requestNoContent(
        client.api.labels[':id'].$delete({
          param: { id: encodePathSegment(id) },
        }),
      ).map(() => ({ deleted: true, id })),
  }),
] as const
