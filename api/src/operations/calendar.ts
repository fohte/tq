import { z } from 'zod'

import { defineOperation, requestJson } from '#operations/types'

const eventsSchema = z.object({
  timeMin: z.iso.datetime(),
  timeMax: z.iso.datetime(),
})

export const calendarOperations = [
  defineOperation(eventsSchema, {
    path: ['calendar', 'events'],
    description: 'List calendar events between two ISO 8601 timestamps',
    positionalArgs: ['timeMin', 'timeMax'],
    kind: 'read',
    routes: ['GET /api/calendar/events'],
    cli: {
      group: { description: 'Manage calendar events', order: 9 },
      output: { kind: 'json' },
    },
    run: (client, query) =>
      requestJson(client.api.calendar.events.$get({ query })),
  }),
] as const
