import { err, errAsync, ok, type Result } from 'neverthrow'
import { z } from 'zod'

import { taskIdOrNumber } from '#lib/numeric-id'
import { encodePathSegment } from '#operations/path-segment'
import {
  recurrenceCliOptions,
  recurrenceRuleFromCli,
} from '#operations/recurrence-cli'
import {
  defineOperation,
  formatInputIssues,
  type OperationError,
  requestJson,
  requestNoContent,
} from '#operations/types'
import {
  createScheduleSchema,
  MAX_SCHEDULE_DATE_RANGE_DAYS,
  scheduleDateRangeInputSchema,
  scheduleDateRangeSchema,
  withScheduleDateRange,
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

const timeBlockListMcpInputSchema = withScheduleDateRange(
  timeBlockListInputSchema,
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

function validateScheduleDateRange(input: {
  startDate: string
  endDate: string
}): Result<{ startDate: string; endDate: string }, OperationError> {
  const result = scheduleDateRangeSchema.safeParse(input)
  return result.success
    ? ok(result.data)
    : err({
        kind: 'input',
        message: formatInputIssues(result.error),
      })
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
    description: `List time blocks that overlap an inclusive local date range of up to ${String(MAX_SCHEDULE_DATE_RANGE_DAYS)} calendar days. Pass a timezone offset using the Date.getTimezoneOffset() convention.`,
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
      const dateRange = validateScheduleDateRange({
        startDate,
        endDate,
      })
      if (dateRange.isErr()) return errAsync(dateRange.error)

      return requestJson(
        client.api.schedule['time-blocks'].$get({
          query: { ...dateRange.value, tzOffset: String(tzOffset) },
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
  defineOperation(scheduleDateRangeInputSchema, {
    path: ['schedule', 'events', 'list'],
    description: `List schedule events for an inclusive date range of up to ${String(MAX_SCHEDULE_DATE_RANGE_DAYS)} calendar days. Split longer ranges into multiple requests.`,
    positionalArgs: ['startDate', 'endDate'],
    kind: 'read',
    mcpInputSchema: scheduleDateRangeSchema,
    routes: ['GET /api/schedule/events'],
    cli: { output: { kind: 'json' } },
    run: (client, query) => {
      const dateRange = validateScheduleDateRange(query)
      if (dateRange.isErr()) return errAsync(dateRange.error)
      return requestJson(
        client.api.schedule.events.$get({ query: dateRange.value }),
      )
    },
  }),
  defineOperation(createScheduleSchema, {
    path: ['schedule', 'events', 'create'],
    description:
      'Create a schedule event. startTime and endTime are local HH:MM times; if endTime is earlier than startTime, it ends the following day. Without recurrence, the event appears every day. For recurrence, daily and custom rules appear every day, weekly rules use daysOfWeek (0 = Sunday through 6 = Saturday), and monthly rules use dayOfMonth. interval is stored but does not affect schedule event dates yet.',
    positionalArgs: ['title', 'startTime', 'endTime'],
    kind: 'write',
    routes: ['POST /api/schedule/events'],
    cli: {
      customOptions: recurrenceCliOptions(
        'Recurrence interval (stored but currently ignored when expanding schedule event dates)',
      ),
      excludeFields: ['recurrence'],
      mapInput: (input, options) =>
        recurrenceRuleFromCli(options).map((recurrence) =>
          recurrence === undefined ? input : { ...input, recurrence },
        ),
      output: { kind: 'json' },
    },
    run: (client, json) =>
      requestJson(client.api.schedule.events.$post({ json })),
  }),
] as const
