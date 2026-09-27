import { z } from 'zod'

import { encodePathSegment, pathSegmentSchema } from '#operations/path-segment'
import { defineOperation, requestJson } from '#operations/types'
import { putQueueItemsSchema, queueDateSchema } from '#schemas/queue'

const queueKeySchema = pathSegmentSchema('Queue key')

const queueGetInputSchema = z.object({
  key: queueKeySchema,
  date: queueDateSchema
    .optional()
    .describe(
      'Date to fetch the queue for, as YYYY-MM-DD. Defaults to the current UTC date; pass an explicit date when your local date differs.',
    ),
})

const queueSetInputSchema = z.object({
  key: queueKeySchema,
  date: putQueueItemsSchema.shape.date,
  taskIds: putQueueItemsSchema.shape.taskIds
    .optional()
    .describe('Task UUIDs in queue order. Omit to clear the queue.'),
})

export const queueOperations = [
  defineOperation(z.object({}), {
    path: ['queue', 'list'],
    description: 'List the available queues.',
    positionalArgs: [],
    kind: 'read',
    routes: ['GET /api/queues'],
    cli: { output: { kind: 'json' } },
    run: (client) => requestJson(client.api.queues.$get()),
  }),
  defineOperation(queueGetInputSchema, {
    path: ['queue', 'get'],
    description:
      'List a queue for a date (YYYY-MM-DD). The date defaults to the current UTC date; pass an explicit date when your local date differs.',
    positionalArgs: ['key', { name: 'date', optional: true }],
    kind: 'read',
    routes: ['GET /api/queues/:key/items'],
    cli: { output: { kind: 'json' } },
    run: (client, { key, date }) =>
      requestJson(
        client.api.queues[':key'].items.$get({
          param: { key: encodePathSegment(key) },
          query: { date: date ?? new Date().toISOString().slice(0, 10) },
        }),
      ),
  }),
  defineOperation(queueSetInputSchema, {
    path: ['queue', 'set'],
    description:
      'Replace a queue for a date (YYYY-MM-DD) with the given task UUIDs, in order. Omit taskIds to clear the queue.',
    positionalArgs: [
      'key',
      'date',
      { name: 'taskIds', optional: true, variadic: true },
    ],
    kind: 'write',
    routes: ['PUT /api/queues/:key/items'],
    cli: { output: { kind: 'json' } },
    run: (client, { key, date, taskIds }) =>
      requestJson(
        client.api.queues[':key'].items.$put({
          param: { key: encodePathSegment(key) },
          json: { date, taskIds: taskIds ?? [] },
        }),
      ),
  }),
] as const
