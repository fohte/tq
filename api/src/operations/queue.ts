import { z } from 'zod'

import { encodePathSegment, pathSegmentSchema } from '#operations/path-segment'
import {
  defineOperation,
  requestJson,
  requestNoContent,
} from '#operations/types'
import { putQueueItemsSchema, queueDateSchema } from '#schemas/queue'

const queueKeySchema = pathSegmentSchema('Queue key')

const queueGetInputSchema = z.object({
  key: queueKeySchema,
  date: queueDateSchema
    .optional()
    .describe(
      'Date to fetch the queue for, as YYYY-MM-DD. Defaults to today in the local timezone.',
    ),
})

const queueSetInputSchema = z.object({
  key: queueKeySchema,
  date: putQueueItemsSchema.shape.date,
  taskIds: putQueueItemsSchema.shape.taskIds
    .optional()
    .describe(
      'Task UUIDs to retain or add. Existing items keep their position; new items append in request order. Queues display by due date, then position. Omit to clear the queue.',
    ),
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
    description:
      "List a queue for a date (YYYY-MM-DD). Defaults to today in the local timezone; reading today's queue first carries unfinished items forward.",
    positionalArgs: ['key', { name: 'date', optional: true }],
    kind: 'write',
    routes: ['POST /api/queues/carry-over', 'GET /api/queues/:key/items'],
    cli: { output: { kind: 'json' } },
    run: (client, { key, date }) => {
      const today = formatLocalDate(new Date())
      const requestedDate = date ?? today
      const getItems = () =>
        requestJson(
          client.api.queues[':key'].items.$get({
            param: { key: encodePathSegment(key) },
            query: { date: requestedDate },
          }),
        )

      return requestedDate === today
        ? requestNoContent(
            client.api.queues['carry-over'].$post({
              json: { date: requestedDate },
            }),
          ).andThen(getItems)
        : getItems()
    },
  }),
  defineOperation(queueSetInputSchema, {
    path: ['queue', 'set'],
    description:
      'Replace queue membership for a date (YYYY-MM-DD). Existing items keep their position and new items append in request order. Display order uses due date, then position. Omit taskIds to clear the queue.',
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

function formatLocalDate(date: Date): string {
  return `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
