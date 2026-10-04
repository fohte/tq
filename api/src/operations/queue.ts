import { z } from 'zod'

import { encodePathSegment, pathSegmentSchema } from '#operations/path-segment'
import { defineOperation, requestJson } from '#operations/types'
import { putQueueItemsSchema, queueDateSchema } from '#schemas/queue'

const queueKeySchema = pathSegmentSchema('Queue key')

const queueGetInputSchema = z.object({
  key: queueKeySchema,
  date: queueDateSchema.describe('Date to fetch the queue for, as YYYY-MM-DD.'),
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
    cli: {
      group: { description: 'Manage task queues', order: 8 },
      output: { kind: 'json' },
    },
    run: (client) => requestJson(client.api.queues.$get()),
  }),
  defineOperation(queueGetInputSchema, {
    path: ['queue', 'get'],
    description: 'List a queue for a date (YYYY-MM-DD).',
    positionalArgs: ['key', 'date'],
    kind: 'read',
    routes: ['GET /api/queues/:key/items'],
    cli: { output: { kind: 'json' } },
    run: (client, { key, date }) =>
      requestJson(
        client.api.queues[':key'].items.$get({
          param: { key: encodePathSegment(key) },
          query: { date },
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
    kind: 'delete',
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
