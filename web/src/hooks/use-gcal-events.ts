import { useQuery } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { api } from '#lib/api'
import { assertStatus, unwrapOrThrow } from '#lib/assert-response'
import { getDayIsoRange } from '#lib/date-range'

export type GcalEvent = InferResponseType<
  typeof api.api.calendar.events.$get,
  200
>[number]

// Google Calendar has no webhook integration here, so changes are detected
// by polling while the calendar is open.
const GCAL_POLL_INTERVAL_MS = 60_000

export class GcalAuthRequiredError extends Error {
  constructor() {
    super('Google Calendar authentication is required')
    this.name = 'GcalAuthRequiredError'
  }
}

const gcalEventsKeys = {
  all: ['gcal-events'] as const,
  list: (startDate: string, endDate: string, context: 'work' | 'personal') =>
    [...gcalEventsKeys.all, 'list', { startDate, endDate }, context] as const,
}

export function useGcalEvents(
  startDate: string,
  endDate: string,
  context: 'work' | 'personal',
  enabled = true,
) {
  return useQuery({
    queryKey: gcalEventsKeys.list(startDate, endDate, context),
    enabled,
    queryFn: async () => {
      const { timeMin } = getDayIsoRange(startDate)
      const { timeMax } = getDayIsoRange(endDate)
      const res = await api.api.calendar.events.$get({
        query: { timeMin, timeMax, context },
      })
      if (res.status === 401) {
        // eslint-disable-next-line no-restricted-syntax -- React Query queryFn boundary: must throw a typed error so callers can check `error instanceof GcalAuthRequiredError`
        throw new GcalAuthRequiredError()
      }
      return unwrapOrThrow(assertStatus(res, 200)).json()
    },
    retry: false,
    refetchInterval: GCAL_POLL_INTERVAL_MS,
  })
}
