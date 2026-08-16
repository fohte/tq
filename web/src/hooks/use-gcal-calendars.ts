import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { api } from '#lib/api'
import { assertStatus } from '#lib/assert-response'

export type GcalCalendar = InferResponseType<
  (typeof api.api.calendar.accounts)[':accountId']['calendars']['$get'],
  200
>[number]

export const gcalCalendarsKeys = {
  list: (accountId: string) => ['gcal-calendars', accountId] as const,
}

export function useGcalCalendarsList(accountId: string, enabled: boolean) {
  return useQuery({
    queryKey: gcalCalendarsKeys.list(accountId),
    queryFn: async () => {
      const res = await api.api.calendar.accounts[':accountId'].calendars.$get({
        param: { accountId },
      })
      const result = assertStatus(res, 200)
      if (result.isErr()) throw result.error
      return result.value.json()
    },
    enabled,
    retry: false,
  })
}

export function useUpdateCalendarSubscription(accountId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      calendarId,
      subscribed,
    }: {
      calendarId: string
      subscribed: boolean
    }) => {
      const res = await api.api.calendar.accounts[':accountId'].calendars[
        ':calendarId'
      ].subscription.$put({
        param: { accountId, calendarId },
        json: { subscribed },
      })
      const result = assertStatus(res, 200)
      if (result.isErr()) throw result.error
      return result.value.json()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: gcalCalendarsKeys.list(accountId),
      })
    },
  })
}
