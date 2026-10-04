import { errAsync } from 'neverthrow'
import { z } from 'zod'

import { encodePathSegment } from '#operations/path-segment'
import {
  defineOperation,
  requestJson,
  requestNoContent,
} from '#operations/types'
import { scheduleOverrideOperationInputSchema } from '#schemas/schedule-override'

const clearScheduleOverrideInputSchema = z.object({
  scheduleId: z.string().min(1).describe('Recurring schedule ID.'),
  occurrenceDate: z.iso
    .date()
    .describe('Date on which this occurrence starts, in YYYY-MM-DD format.'),
})

export const scheduleOverrideOperations = [
  defineOperation(scheduleOverrideOperationInputSchema, {
    path: ['schedule', 'override', 'set'],
    description:
      'Change or skip one occurrence of a recurring schedule. Provide both startTime and endTime to change its time, or set mode to skip and omit both times.',
    positionalArgs: ['scheduleId', 'occurrenceDate'],
    kind: 'write',
    routes: [
      'PUT /api/schedule/recurring/:scheduleId/overrides/:occurrenceDate',
    ],
    cli: {
      group: { description: 'Manage schedule overrides', order: 10 },
      output: { kind: 'json' },
    },
    run: (client, input) => {
      const { scheduleId, occurrenceDate, startTime, endTime, mode } = input
      const param = {
        scheduleId: encodePathSegment(scheduleId),
        occurrenceDate: encodePathSegment(occurrenceDate),
      }

      if (mode === 'skip') {
        if (startTime !== undefined || endTime !== undefined) {
          return errAsync({
            kind: 'input',
            message: 'Omit startTime and endTime when mode is skip.',
          })
        }

        return requestJson(
          client.api.schedule.recurring[':scheduleId'].overrides[
            ':occurrenceDate'
          ].$put({ param, json: { skipped: true } }),
        )
      }

      if (startTime === undefined || endTime === undefined) {
        return errAsync({
          kind: 'input',
          message: 'Provide both startTime and endTime, or set mode to skip.',
        })
      }

      return requestJson(
        client.api.schedule.recurring[':scheduleId'].overrides[
          ':occurrenceDate'
        ].$put({ param, json: { startTime, endTime } }),
      )
    },
  }),
  defineOperation(clearScheduleOverrideInputSchema, {
    path: ['schedule', 'override', 'clear'],
    description:
      'Clear the override for one occurrence of a recurring schedule and restore its default time.',
    positionalArgs: ['scheduleId', 'occurrenceDate'],
    kind: 'delete',
    routes: [
      'DELETE /api/schedule/recurring/:scheduleId/overrides/:occurrenceDate',
    ],
    cli: {
      group: { description: 'Manage schedule overrides', order: 10 },
      output: { kind: 'json' },
    },
    run: (client, { scheduleId, occurrenceDate }) =>
      requestNoContent(
        client.api.schedule.recurring[':scheduleId'].overrides[
          ':occurrenceDate'
        ].$delete({
          param: {
            scheduleId: encodePathSegment(scheduleId),
            occurrenceDate: encodePathSegment(occurrenceDate),
          },
        }),
      ).map(() => ({ cleared: true, scheduleId, occurrenceDate })),
  }),
] as const
