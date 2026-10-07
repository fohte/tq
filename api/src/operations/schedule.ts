import { err, errAsync, ok, type Result } from 'neverthrow'
import { z } from 'zod'

import { taskIdOrNumber } from '#lib/numeric-id'
import { encodePathSegment } from '#operations/path-segment'
import {
  defineOperation,
  formatInputIssues,
  requestJson,
  requestNoContent,
} from '#operations/types'
import {
  isScheduleDateRangeValid,
  MAX_SCHEDULE_DATE_RANGE_DAYS,
  SCHEDULE_DATE_RANGE_ERROR_MESSAGE,
  scheduleDateRangeInputSchema,
  scheduleDateRangeSchema,
} from '#schemas/schedule'

const timeBlockIdSchema = z.object({ id: z.uuid() })

const timeBlockListInputSchema = scheduleDateRangeInputSchema.extend({
  tzOffset: z
    .number()
    .int()
    .describe(
      'Required timezone offset in minutes using the Date.getTimezoneOffset() convention.',
    ),
})

const timeBlockListMcpInputSchema = timeBlockListInputSchema.refine(
  isScheduleDateRangeValid,
  { message: SCHEDULE_DATE_RANGE_ERROR_MESSAGE, path: ['endDate'] },
)

const createTimeBlockInputSchema = z.object({
  taskId: taskIdOrNumber.describe('Task id or task number.'),
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

const recurringScheduleListInputSchema = scheduleDateRangeInputSchema

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
    mcpInputSchema: timeBlockListMcpInputSchema,
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
    run: (client, { startDate, endDate, tzOffset }) => {
      const dateRange = scheduleDateRangeSchema.safeParse({
        startDate,
        endDate,
      })
      if (!dateRange.success) {
        return errAsync({
          kind: 'input',
          message: formatInputIssues(dateRange.error),
        })
      }

      return requestJson(
        client.api.schedule['time-blocks'].$get({
          query: { ...dateRange.data, tzOffset: String(tzOffset) },
        }),
      )
    },
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
    description: `List expanded recurring schedule instances for an inclusive date range of up to ${String(MAX_SCHEDULE_DATE_RANGE_DAYS)} calendar days. Split longer ranges into multiple requests.`,
    positionalArgs: ['startDate', 'endDate'],
    kind: 'read',
    mcpInputSchema: scheduleDateRangeSchema,
    routes: ['GET /api/schedule/recurring'],
    cli: { output: { kind: 'json' } },
    run: (client, query) => {
      const dateRange = scheduleDateRangeSchema.safeParse(query)
      if (!dateRange.success) {
        return errAsync({
          kind: 'input',
          message: formatInputIssues(dateRange.error),
        })
      }
      return requestJson(
        client.api.schedule.recurring.$get({ query: dateRange.data }),
      )
    },
  }),
] as const
