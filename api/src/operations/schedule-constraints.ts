import { err, fromThrowable, ok } from 'neverthrow'
import { z } from 'zod'

import { encodePathSegment } from '#operations/path-segment'
import {
  defineOperation,
  formatInputIssues,
  requestJson,
  requestNoContent,
} from '#operations/types'
import { scheduleConstraintSchema } from '#services/schedule-constraints'

const scheduleIdSchema = z.object({ id: z.uuid() })
const scheduleConstraintSetInputSchema = scheduleIdSchema.extend({
  constraints: scheduleConstraintSchema,
})

const parseScheduleConstraintsJson = fromThrowable(
  (value: string): unknown => JSON.parse(value) as unknown,
  (cause) =>
    new Error(
      `Invalid --constraints JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
    ),
)

function mapCliScheduleConstraints(
  input: Record<string, unknown>,
  options: Record<string, unknown>,
) {
  const rawConstraints = options['constraints']
  if (rawConstraints === undefined) return ok(input)
  if (typeof rawConstraints !== 'string') {
    return err(new Error('--constraints must be a JSON object'))
  }

  return parseScheduleConstraintsJson(rawConstraints).andThen((value) => {
    const constraints = scheduleConstraintSchema.safeParse(value)
    return constraints.success
      ? ok({ ...input, constraints: constraints.data })
      : err(new Error(formatInputIssues(constraints.error)))
  })
}

export const scheduleConstraintOperations = [
  defineOperation(scheduleIdSchema, {
    path: ['schedule', 'constraints', 'get'],
    description: 'Get the constraints for a schedule event, if any.',
    positionalArgs: ['id'],
    kind: 'read',
    routes: ['GET /api/schedule/events/:id/constraints'],
    cli: { output: { kind: 'json' } },
    run: (client, { id }) =>
      requestJson(
        client.api.schedule.events[':id'].constraints.$get({
          param: { id: encodePathSegment(id) },
        }),
      ),
  }),
  defineOperation(scheduleConstraintSetInputSchema, {
    path: ['schedule', 'constraints', 'set'],
    description:
      'Set the constraints for a schedule event. Provide the complete constraint object as JSON.',
    positionalArgs: ['id'],
    kind: 'write',
    routes: ['PUT /api/schedule/events/:id/constraints'],
    cli: {
      customOptions: [
        {
          flags: '--constraints <json>',
          description: 'Complete schedule constraint object as JSON',
        },
      ],
      excludeFields: ['constraints'],
      mapInput: mapCliScheduleConstraints,
      output: { kind: 'json' },
    },
    run: (client, { id, constraints }) =>
      requestJson(
        client.api.schedule.events[':id'].constraints.$put({
          param: { id: encodePathSegment(id) },
          json: constraints,
        }),
      ),
  }),
  defineOperation(scheduleIdSchema, {
    path: ['schedule', 'constraints', 'delete'],
    description: 'Delete the constraints for a schedule event.',
    positionalArgs: ['id'],
    kind: 'delete',
    routes: ['DELETE /api/schedule/events/:id/constraints'],
    cli: { output: { kind: 'json' } },
    run: (client, { id }) =>
      requestNoContent(
        client.api.schedule.events[':id'].constraints.$delete({
          param: { id: encodePathSegment(id) },
        }),
      ).map(() => ({ deleted: true, id })),
  }),
] as const
