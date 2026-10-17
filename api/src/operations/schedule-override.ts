import { errAsync, ok } from 'neverthrow'

import { encodePathSegment } from '#operations/path-segment'
import {
  defineOperation,
  requestJson,
  requestNoContent,
} from '#operations/types'
import {
  clearScheduleOverrideInputSchema,
  scheduleOverrideOperationInputSchema,
} from '#schemas/schedule-override'

export const scheduleOverrideOperations = [
  defineOperation(scheduleOverrideOperationInputSchema, {
    path: ['schedule', 'override', 'set'],
    description:
      'Move, change, or skip one occurrence of a recurring event. Provide date, startTime, and endTime to move it to another date; provide both times to change its time; set mode to skip and omit date and both times. Set dryRun to preview the change without saving it.',
    positionalArgs: ['scheduleId', 'occurrenceDate'],
    kind: 'write',
    routes: ['PUT /api/schedule/events/:scheduleId/overrides/:occurrenceDate'],
    cli: {
      group: { description: 'Manage schedule overrides', order: 10 },
      customOptions: [
        {
          flags: '--dry-run',
          description: 'Preview the change without saving it',
        },
      ],
      excludeFields: ['dryRun'],
      mapInput: (input, options) =>
        ok(options['dryRun'] === true ? { ...input, dryRun: true } : input),
      output: { kind: 'json' },
    },
    run: (client, input) => {
      const {
        scheduleId,
        occurrenceDate,
        date,
        startTime,
        endTime,
        mode,
        dryRun,
      } = input
      const param = {
        scheduleId: encodePathSegment(scheduleId),
        occurrenceDate: encodePathSegment(occurrenceDate),
      }

      if (mode === 'skip') {
        if (
          date !== undefined ||
          startTime !== undefined ||
          endTime !== undefined
        ) {
          return errAsync({
            kind: 'input',
            message: 'Omit date, startTime, and endTime when mode is skip.',
          })
        }

        return requestJson(
          client.api.schedule.events[':scheduleId'].overrides[
            ':occurrenceDate'
          ].$put({ param, json: { skipped: true, dryRun } }),
        )
      }

      if (startTime === undefined || endTime === undefined) {
        return errAsync({
          kind: 'input',
          message: 'Provide both startTime and endTime, or set mode to skip.',
        })
      }

      return requestJson(
        client.api.schedule.events[':scheduleId'].overrides[
          ':occurrenceDate'
        ].$put({ param, json: { date, startTime, endTime, dryRun } }),
      )
    },
  }),
  defineOperation(clearScheduleOverrideInputSchema, {
    path: ['schedule', 'override', 'clear'],
    description:
      'Clear the override for one occurrence of a recurring event and restore its default time.',
    positionalArgs: ['scheduleId', 'occurrenceDate'],
    kind: 'delete',
    routes: [
      'DELETE /api/schedule/events/:scheduleId/overrides/:occurrenceDate',
    ],
    cli: { output: { kind: 'json' } },
    run: (client, { scheduleId, occurrenceDate }) =>
      requestNoContent(
        client.api.schedule.events[':scheduleId'].overrides[
          ':occurrenceDate'
        ].$delete({
          param: {
            scheduleId: encodePathSegment(scheduleId),
            occurrenceDate: encodePathSegment(occurrenceDate),
          },
          query: {},
        }),
      ).map(() => ({ cleared: true, scheduleId, occurrenceDate })),
  }),
] as const
