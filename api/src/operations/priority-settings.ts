import { err, fromThrowable, ok } from 'neverthrow'
import { z } from 'zod'

import { defineOperation, requestJson } from '#operations/types'
import { updatePrioritySettingsSchema } from '#schemas/priority-settings'

const parseJson = fromThrowable(
  (value: string): unknown => JSON.parse(value) as unknown,
  (cause) =>
    new Error(
      `Invalid --settings JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
    ),
)

function mapCliSettings(
  input: Record<string, unknown>,
  options: Record<string, unknown>,
) {
  const rawSettings = options['settings']
  if (typeof rawSettings !== 'string') {
    return err(
      new Error('Pass the complete priority list with --settings <json>.'),
    )
  }

  return parseJson(rawSettings).andThen((value) => {
    const settings = updatePrioritySettingsSchema.safeParse(value)
    return settings.success
      ? ok({ ...input, settings: settings.data })
      : err(
          new Error(
            settings.error.issues.map(({ message }) => message).join('; '),
          ),
        )
  })
}

export const prioritySettingsOperations = [
  defineOperation(z.object({}), {
    path: ['priority-settings', 'get'],
    description:
      'Get the configured names, descriptions, and order of priorities.',
    positionalArgs: [],
    kind: 'read',
    routes: ['GET /api/priority-settings'],
    cli: {
      group: { description: 'Manage priority settings', order: 20 },
      output: { kind: 'json' },
    },
    run: (client) => requestJson(client.api['priority-settings'].$get()),
  }),
  defineOperation(z.object({ settings: updatePrioritySettingsSchema }), {
    path: ['priority-settings', 'update'],
    description:
      'Replace the names, descriptions, and order of all priorities.',
    positionalArgs: [],
    kind: 'write',
    routes: ['PUT /api/priority-settings'],
    cli: {
      group: { description: 'Manage priority settings', order: 20 },
      excludeFields: ['settings'],
      customOptions: [
        {
          flags: '--settings <json>',
          description:
            'Complete list of priority names, descriptions, and order',
        },
      ],
      mapInput: mapCliSettings,
      output: { kind: 'json' },
    },
    run: (client, { settings }) =>
      requestJson(client.api['priority-settings'].$put({ json: settings })),
  }),
] as const
