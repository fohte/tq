import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import type { InferResponseType } from 'hono/client'

type Schedule = InferResponseType<
  typeof api.api.schedule.recurring.$get,
  200
>[number]

const scheduleKeys = {
  all: ['schedules'] as const,
  lists: ['schedules', 'list'] as const,
  list: (date: string) => [...scheduleKeys.lists, date] as const,
}

export type { Schedule }

export function useScheduleList(date: string) {
  return useQuery({
    queryKey: scheduleKeys.list(date),
    queryFn: async () => {
      const res = await api.api.schedule.recurring.$get({
        query: { date },
      })
      if (!res.ok) throw new Error('Failed to fetch schedules')
      return res.json()
    },
  })
}

export interface CreateScheduleInput {
  title: string
  startTime: string
  endTime: string
  recurrence?: {
    type: 'daily' | 'weekly' | 'monthly' | 'custom'
    interval: number
    daysOfWeek?: number[]
    dayOfMonth?: number
  }
  context?: 'work' | 'personal' | 'dev'
  color?: string
}

export function useCreateSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateScheduleInput) => {
      const res = await api.api.schedule.recurring.$post({
        json: input,
      })
      if (!res.ok) throw new Error('Failed to create schedule')
      return res.json()
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all })
    },
  })
}

export interface UpdateScheduleInput {
  title?: string
  startTime?: string
  endTime?: string
  recurrence?: {
    type: 'daily' | 'weekly' | 'monthly' | 'custom'
    interval: number
    daysOfWeek?: number[]
    dayOfMonth?: number
  } | null
  context?: 'work' | 'personal' | 'dev' | null
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
      const res = await api.api.schedule.recurring[':id'].$patch({
        param: { id },
        json: input,
      })
      if (!res.ok) throw new Error('Failed to update schedule')
      return res.json()
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all })
    },
  })
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.schedule.recurring[':id'].$delete({
        param: { id },
      })
      if (!res.ok) throw new Error('Failed to delete schedule')
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
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all })
    },
  })
}
