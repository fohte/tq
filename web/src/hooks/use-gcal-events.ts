import { useQuery } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'
import { useEffect, useRef } from 'react'

import { api } from '#lib/api'
import { assertStatus } from '#lib/assert-response'
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
  list: (date: string) => [...gcalEventsKeys.all, 'list', date] as const,
}

export function useGcalEvents(date: string) {
  return useQuery({
    queryKey: gcalEventsKeys.list(date),
    queryFn: async () => {
      const { timeMin, timeMax } = getDayIsoRange(date)
      const res = await api.api.calendar.events.$get({
        query: { timeMin, timeMax },
      })
      if (res.status === 401) {
        throw new GcalAuthRequiredError()
      }
      const result = assertStatus(res, 200)
      if (result.isErr()) throw result.error
      return result.value.json()
    },
    retry: false,
    refetchInterval: GCAL_POLL_INTERVAL_MS,
  })
}

// Runs `onChange` whenever `gcalEvents` changes to a new value after the
// first render. Relies on TanStack Query's structural sharing keeping the
// query data reference stable across refetches when nothing changed, so
// this only fires on an actual content change, not every poll.
export function useAutoRescheduleOnGcalChange(
  gcalEvents: GcalEvent[] | undefined,
  onChange: () => void,
  enabled: boolean,
) {
  const previousEventsRef = useRef<GcalEvent[] | undefined>(undefined)
  const hasSeenDataRef = useRef(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!enabled) return
    if (gcalEvents == null) return

    if (!hasSeenDataRef.current) {
      hasSeenDataRef.current = true
      previousEventsRef.current = gcalEvents
      return
    }

    if (previousEventsRef.current !== gcalEvents) {
      previousEventsRef.current = gcalEvents
      onChangeRef.current()
    }
  }, [gcalEvents, enabled])
}
