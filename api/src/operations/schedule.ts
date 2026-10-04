import { err, errAsync, ok, type Result } from 'neverthrow'
import { z } from 'zod'

import { encodePathSegment } from '#operations/path-segment'
import {
  defineOperation,
  requestJson,
  requestNoContent,
} from '#operations/types'

const timeBlockIdSchema = z.object({ id: z.uuid() })

const timeBlockListInputSchema = z.object({
  startDate: z.iso
    .date()
    .describe('First local date to include, as YYYY-MM-DD.'),
  endDate: z.iso.date().describe('Last local date to include, as YYYY-MM-DD.'),
  tzOffset: z
    .number()
    .int()
    .describe(
      'Required timezone offset in minutes using the Date.getTimezoneOffset() convention.',
    ),
})

const createTimeBlockInputSchema = z.object({
  taskId: z.uuid(),
  startTime: z.iso.datetime().describe('ISO 8601 UTC datetime ending in Z.'),
  endTime: z.iso.datetime().describe('ISO 8601 UTC datetime ending in Z.'),
  isAutoScheduled: z.boolean().optional(),
})

const updateTimeBlockInputSchema = z.object({
  id: z.uuid(),
  startTime: z.iso
    .datetime()
    .describe('ISO 8601 UTC datetime ending in Z.')
    .optional(),
  endTime: z.iso
    .datetime()
    .describe('ISO 8601 UTC datetime ending in Z.')
    .optional(),
  isAutoScheduled: z.boolean().optional(),
})

const recurringScheduleListInputSchema = z.object({
  startDate: z.iso.date().describe('First date to include, as YYYY-MM-DD.'),
  endDate: z.iso.date().describe('Last date to include, as YYYY-MM-DD.'),
})

function isRecurringScheduleRangeValid({
  startDate,
  endDate,
}: {
  startDate: string
  endDate: string
}): boolean {
  const rangeMs =
    Date.parse(`${endDate}T00:00:00.000Z`) -
    Date.parse(`${startDate}T00:00:00.000Z`)
  return rangeMs >= 0 && rangeMs < 31 * 24 * 60 * 60 * 1000
}

const recurringScheduleMcpInputSchema = recurringScheduleListInputSchema.refine(
  isRecurringScheduleRangeValid,
  {
    message: 'Date range must be chronological and no longer than 31 days',
    path: ['endDate'],
  },
)

const autoScheduleCliOptions = [
  {
    flags: '--auto-scheduled',
    description: 'Mark the time block as auto-scheduled',
  },
  { flags: '--manual', description: 'Mark the time block as manual' },
] as const

function mapCliTimezoneOffset(
  input: Record<string, unknown>,
  options: Record<string, unknown>,
): Result<Record<string, unknown>, Error> {
  const tzOffset = z.number().int().safeParse(Number(options['tzOffset']))
  return tzOffset.success
    ? ok({ ...input, tzOffset: tzOffset.data })
    : err(new Error('tzOffset must be an integer number of minutes'))
}

function mapCliAutoScheduleFlags(
  input: Record<string, unknown>,
  options: Record<string, unknown>,
): Result<Record<string, unknown>, Error> {
  const isAutoScheduled = options['autoScheduled'] === true
  const isManual = options['manual'] === true

  if (isAutoScheduled && isManual) {
    return err(new Error('Use only one of --auto-scheduled or --manual'))
  }
  if (!isAutoScheduled && !isManual) return ok(input)

  return ok({ ...input, isAutoScheduled })
}

export const scheduleOperations = [
  defineOperation(timeBlockListInputSchema, {
    path: ['schedule', 'time-blocks', 'list'],
    description:
      'List time blocks that overlap an inclusive local date range. Pass a timezone offset using the Date.getTimezoneOffset() convention.',
    positionalArgs: ['startDate', 'endDate'],
    kind: 'read',
    routes: ['GET /api/schedule/time-blocks'],
    cli: {
      group: { description: 'Manage task schedules', order: 10 },
      customOptions: [
        {
          flags: '--tz-offset <minutes>',
          description:
            'Required timezone offset in minutes using the Date.getTimezoneOffset() convention',
        },
      ],
      excludeFields: ['tzOffset'],
      mapInput: mapCliTimezoneOffset,
      output: { kind: 'json' },
    },
    run: (client, { startDate, endDate, tzOffset }) =>
      requestJson(
        client.api.schedule['time-blocks'].$get({
          query: { startDate, endDate, tzOffset: String(tzOffset) },
        }),
      ),
  }),
  defineOperation(createTimeBlockInputSchema, {
    path: ['schedule', 'time-blocks', 'create'],
    description:
      'Create a task time block. Start and end must be ISO 8601 UTC datetimes ending in Z. Time blocks may overlap.',
    positionalArgs: ['taskId', 'startTime', 'endTime'],
    kind: 'write',
    routes: ['POST /api/schedule/time-blocks'],
    cli: {
      customOptions: autoScheduleCliOptions,
      excludeFields: ['isAutoScheduled'],
      mapInput: mapCliAutoScheduleFlags,
      output: { kind: 'json' },
    },
    run: (client, json) =>
      requestJson(client.api.schedule['time-blocks'].$post({ json })),
  }),
  defineOperation(updateTimeBlockInputSchema, {
    path: ['schedule', 'time-blocks', 'update'],
    description:
      'Update a time block. Only provided fields change; start and end must be ISO 8601 UTC datetimes ending in Z.',
    positionalArgs: ['id'],
    kind: 'write',
    routes: ['PATCH /api/schedule/time-blocks/:id'],
    cli: {
      customOptions: autoScheduleCliOptions,
      excludeFields: ['isAutoScheduled'],
      mapInput: mapCliAutoScheduleFlags,
      output: { kind: 'json' },
    },
    run: (client, { id, ...json }) =>
      requestJson(
        client.api.schedule['time-blocks'][':id'].$patch({
          param: { id: encodePathSegment(id) },
          json,
        }),
      ),
  }),
  defineOperation(timeBlockIdSchema, {
    path: ['schedule', 'time-blocks', 'delete'],
    description: 'Delete a time block by id.',
    positionalArgs: ['id'],
    kind: 'delete',
    routes: ['DELETE /api/schedule/time-blocks/:id'],
    cli: { output: { kind: 'json' } },
    run: (client, { id }) =>
      requestNoContent(
        client.api.schedule['time-blocks'][':id'].$delete({
          param: { id: encodePathSegment(id) },
        }),
      ).map(() => ({ deleted: true, id })),
  }),
  defineOperation(recurringScheduleListInputSchema, {
    path: ['schedule', 'recurring', 'list'],
    description:
      'List expanded recurring schedule instances for an inclusive date range of up to 31 calendar days. Split longer ranges into multiple requests.',
    positionalArgs: ['startDate', 'endDate'],
    kind: 'read',
    mcpInputSchema: recurringScheduleMcpInputSchema,
    routes: ['GET /api/schedule/recurring'],
    cli: { output: { kind: 'json' } },
    run: (client, query) =>
      isRecurringScheduleRangeValid(query)
        ? requestJson(client.api.schedule.recurring.$get({ query }))
        : errAsync({
            kind: 'input',
            message:
              'endDate: Date range must be chronological and no longer than 31 days',
          }),
  }),
] as const
