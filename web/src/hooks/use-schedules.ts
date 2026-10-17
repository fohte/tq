import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferRequestType, InferResponseType } from 'hono/client'

import { api } from '#lib/api'
import { assertOk, assertOkOrThrow, unwrapOrThrow } from '#lib/assert-response'
import { formatLocalDate } from '#lib/date-range'
import { scheduleKeys } from '#lib/query-keys'

type Schedule = InferResponseType<
  typeof api.api.schedule.events.$get,
  200
>[number]

export type { Schedule }

export type ScheduleConstraint = NonNullable<
  InferResponseType<
    (typeof api.api.schedule.events)[':id']['constraints']['$get'],
    200
  >['constraint']
>

export type ScheduleConstraintInput = InferRequestType<
  (typeof api.api.schedule.events)[':id']['constraints']['$put']
>['json']

export type ScheduleConstraintCheckInput = InferRequestType<
  (typeof api.api.schedule.events)[':id']['constraint-check']['$post']
>['json']

export type ScheduleConstraintCheckDraft = NonNullable<
  ScheduleConstraintCheckInput['draft']
>

export type ScheduleConstraintCheckResponse = InferResponseType<
  (typeof api.api.schedule.events)[':id']['constraint-check']['$post'],
  200
>

export type ScheduleDetails = InferResponseType<
  (typeof api.api.schedule.events)[':id']['$get'],
  200
>

export type ScheduleOverride = InferResponseType<
  (typeof api.api.schedule.events)[':scheduleId']['overrides']['$get'],
  200
>[number]

export type ScheduleChangePreview = Extract<
  InferResponseType<(typeof api.api.schedule.events)[':id']['$patch'], 200>,
  { changes: unknown }
>

function isScheduleChangePreview(
  value: unknown,
): value is ScheduleChangePreview {
  return (
    typeof value === 'object' &&
    value !== null &&
    'range' in value &&
    'changes' in value &&
    'deletedOverrides' in value
  )
}

export type SchedulePreviewRequest =
  | { kind: 'update'; input: UpdateScheduleInput }
  | {
      kind: 'override'
      occurrenceDate: string
      input: SetScheduleOverrideInput
    }
  | { kind: 'clearOverride'; occurrenceDate: string }

export function useScheduleList(
  startDate: string,
  endDate: string,
  enabled = true,
) {
  return useQuery({
    queryKey: scheduleKeys.list(startDate, endDate),
    enabled,
    queryFn: async () => {
      const res = await api.api.schedule.events.$get({
        query: { startDate, endDate },
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
  })
}

export function useScheduleDetails(
  scheduleId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey:
      scheduleId != null
        ? scheduleKeys.detail(scheduleId)
        : [...scheduleKeys.all, 'detail', 'disabled'],
    enabled: enabled && scheduleId != null,
    queryFn: async () => {
      const res = await api.api.schedule.events[':id'].$get({
        param: { id: scheduleId ?? '' },
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
  })
}

export function useScheduleConstraints(
  scheduleId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey:
      scheduleId != null
        ? scheduleKeys.constraints(scheduleId)
        : [...scheduleKeys.all, 'constraints', 'disabled'],
    enabled: enabled && scheduleId != null,
    queryFn: async () => {
      const res = await api.api.schedule.events[':id'].constraints.$get({
        param: { id: scheduleId ?? '' },
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
  })
}

export function useScheduleConstraintCheck(
  scheduleId: string | undefined,
  input: ScheduleConstraintCheckInput,
  enabled = true,
) {
  return useQuery({
    queryKey: scheduleKeys.constraintCheck(scheduleId ?? 'disabled', input),
    enabled: enabled && scheduleId != null,
    queryFn: async () => {
      if (scheduleId == null) return null

      const res = await api.api.schedule.events[':id'][
        'constraint-check'
      ].$post({
        param: { id: scheduleId },
        json: input,
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
  })
}

export function useSetScheduleConstraints() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string
      input: ScheduleConstraintInput
    }) => {
      const res = await api.api.schedule.events[':id'].constraints.$put({
        param: { id },
        json: input,
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({
        queryKey: scheduleKeys.constraints(variables.id),
      })
    },
  })
}

export function useDeleteScheduleConstraints() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.schedule.events[':id'].constraints.$delete({
        param: { id },
      })
      assertOkOrThrow(res)
    },
    onSettled: (_data, _error, id) => {
      void queryClient.invalidateQueries({
        queryKey: scheduleKeys.constraints(id),
      })
    },
  })
}

export function useScheduleOverrides(
  scheduleId: string | undefined,
  enabled = true,
  fromDate = formatLocalDate(new Date()),
) {
  return useQuery({
    queryKey:
      scheduleId != null
        ? scheduleKeys.overrides(scheduleId, fromDate)
        : [...scheduleKeys.all, 'overrides', 'disabled'],
    enabled: enabled && scheduleId != null,
    queryFn: async () => {
      const res = await api.api.schedule.events[':scheduleId'].overrides.$get({
        param: { scheduleId: scheduleId ?? '' },
        query: { fromDate },
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
  })
}

export function useScheduleChangePreview(
  scheduleId: string | undefined,
  request: SchedulePreviewRequest | null,
  enabled = true,
) {
  return useQuery({
    queryKey: scheduleKeys.preview(scheduleId ?? 'disabled', request),
    enabled: enabled && scheduleId != null && request != null,
    queryFn: async () => {
      if (scheduleId == null || request == null) return null

      if (request.kind === 'update') {
        const res = await api.api.schedule.events[':id'].$patch({
          param: { id: scheduleId },
          json: { ...request.input, dryRun: true },
        })
        assertOkOrThrow(res)
        const result = await res.json()
        return isScheduleChangePreview(result) ? result : null
      }

      if (request.kind === 'override') {
        const res = await api.api.schedule.events[':scheduleId'].overrides[
          ':occurrenceDate'
        ].$put({
          param: { scheduleId, occurrenceDate: request.occurrenceDate },
          json: { ...request.input, dryRun: true },
        })
        assertOkOrThrow(res)
        const result = await res.json()
        return isScheduleChangePreview(result) ? result : null
      }

      const res = await api.api.schedule.events[':scheduleId'].overrides[
        ':occurrenceDate'
      ].$delete({
        param: { scheduleId, occurrenceDate: request.occurrenceDate },
        query: { dryRun: 'true' },
      })
      assertOkOrThrow(res)
      const result = await res.json()
      return isScheduleChangePreview(result) ? result : null
    },
  })
}

export interface CreateScheduleInput {
  title: string
  startDate: string
  startTime: string
  endTime: string
  recurrence?: {
    type: 'daily' | 'weekly' | 'monthly' | 'custom'
    interval: number
    daysOfWeek?: number[]
    dayOfMonth?: number
  }
  context?: 'work' | 'personal'
  color?: string
  remindBeforeMinutes?: number | null
}

export function useCreateSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateScheduleInput) => {
      const res = await api.api.schedule.events.$post({
        json: input,
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: scheduleKeys.all })
    },
  })
}

export interface UpdateScheduleInput {
  dryRun?: boolean
  title?: string
  startDate?: string
  effectiveFrom?: string
  startTime?: string
  endTime?: string
  endDate?: string | null
  remindBeforeMinutes?: number | null
  recurrence?: {
    type: 'daily' | 'weekly' | 'monthly' | 'custom'
    interval: number
    daysOfWeek?: number[]
    dayOfMonth?: number
  } | null
  context?: 'work' | 'personal' | null
  color?: string | null
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string
      input: UpdateScheduleInput
    }) => {
      const res = await api.api.schedule.events[':id'].$patch({
        param: { id },
        json: input,
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: scheduleKeys.all })
    },
  })
}

export type SetScheduleOverrideInput =
  | { skipped: true }
  | {
      date?: string
      startTime: string
      endTime: string
      skipped?: false
    }

export function useSetScheduleOverride() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      scheduleId,
      occurrenceDate,
      input,
    }: {
      scheduleId: string
      occurrenceDate: string
      input: SetScheduleOverrideInput
    }) => {
      const res = await api.api.schedule.events[':scheduleId'].overrides[
        ':occurrenceDate'
      ].$put({
        param: { scheduleId, occurrenceDate },
        json: input,
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: scheduleKeys.all })
    },
  })
}

export function useClearScheduleOverride() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      scheduleId,
      occurrenceDate,
    }: {
      scheduleId: string
      occurrenceDate: string
    }) => {
      const res = await api.api.schedule.events[':scheduleId'].overrides[
        ':occurrenceDate'
      ].$delete({ param: { scheduleId, occurrenceDate }, query: {} })
      assertOkOrThrow(res)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: scheduleKeys.all })
    },
  })
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.schedule.events[':id'].$delete({
        param: { id },
      })
      assertOkOrThrow(res)
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: scheduleKeys.lists })

      const previousLists = queryClient.getQueriesData<Schedule[]>({
        queryKey: scheduleKeys.lists,
      })

      queryClient.setQueriesData<Schedule[]>(
        { queryKey: scheduleKeys.lists },
        (old) => {
          if (!old) return old
          return old.filter((s) => s.scheduleId !== id)
        },
      )

      return { previousLists }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          queryClient.setQueryData(key, data)
        }
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: scheduleKeys.all })
    },
  })
}
