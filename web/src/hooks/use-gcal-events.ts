import { useQuery } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import { assertStatus } from '@web/lib/assert-response'
import { getDayIsoRange } from '@web/lib/date-range'
import type { InferResponseType } from 'hono/client'

export type GcalEvent = InferResponseType<
  typeof api.api.calendar.events.$get,
  200
>[number]

const GCAL_CALENDAR_ID = 'primary'

export class GcalAuthRequiredError extends Error {
  constructor() {
    super('Google Calendar authentication is required')
    this.name = 'GcalAuthRequiredError'
  }
}

const gcalEventsKeys = {
  all: ['gcal-events'] as const,
  list: (date: string) => [...gcalEventsKeys.all, 'list', date] as const,
}

export function useGcalEvents(date: string) {
  return useQuery({
    queryKey: gcalEventsKeys.list(date),
    queryFn: async () => {
      const { timeMin, timeMax } = getDayIsoRange(date)
      const res = await api.api.calendar.events.$get({
        query: { calendarId: GCAL_CALENDAR_ID, timeMin, timeMax },
      })
      if (res.status === 401) {
        throw new GcalAuthRequiredError()
      }
      assertStatus(res, 200)
      return res.json()
    },
    retry: false,
  })
}

export function useGcalAuthUrl(enabled: boolean) {
  return useQuery({
    queryKey: ['gcal-auth-url'],
    queryFn: async () => {
      const res = await api.api.calendar['auth-url'].$get()
      assertStatus(res, 200)
      return res.json()
    },
    enabled,
    retry: false,
  })
}
