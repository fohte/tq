import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { api } from '#lib/api'
import { assertOk, unwrapOrThrow } from '#lib/assert-response'

type TimeBlock = InferResponseType<
  (typeof api.api.schedule)['time-blocks']['$get']
>[number]

export type { TimeBlock }

export const timeBlockKeys = {
  all: ['time-blocks'] as const,
  list: (date: string) => [...timeBlockKeys.all, 'list', date] as const,
}

export function useTimeBlocks(date: string) {
  return useQuery({
    queryKey: timeBlockKeys.list(date),
    queryFn: async () => {
      const res = await api.api.schedule['time-blocks'].$get({
        query: {
          date,
          tzOffset: String(new Date().getTimezoneOffset()),
        },
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
  })
}

export interface CreateTimeBlockInput {
  taskId: string
  startTime: string
  endTime: string
}

export function useCreateTimeBlock() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateTimeBlockInput) => {
      const res = await api.api.schedule['time-blocks'].$post({
        json: {
          taskId: input.taskId,
          startTime: input.startTime,
          endTime: input.endTime,
        },
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onMutate: async (input) => {
      const d = new Date(input.startTime)
      const date = `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const queryKey = timeBlockKeys.list(date)

      await queryClient.cancelQueries({ queryKey })

      const previousData = queryClient.getQueryData<TimeBlock[]>(queryKey)

      const now = new Date().toISOString()
      const optimisticBlock: TimeBlock = {
        id: `optimistic-${String(Date.now())}`,
        taskId: input.taskId,
        startTime: input.startTime,
        endTime: input.endTime,
        isAutoScheduled: false,
        createdAt: now,
        updatedAt: now,
      }

      queryClient.setQueryData<TimeBlock[]>(queryKey, (old = []) =>
        [...old, optimisticBlock].sort(
          (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
        ),
      )

      return { previousData, queryKey }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(context.queryKey, context.previousData)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: timeBlockKeys.all })
    },
  })
}

export interface UpdateTimeBlockInput {
  id: string
  startTime?: string
  endTime?: string
  isAutoScheduled?: boolean
}

export function useUpdateTimeBlock() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateTimeBlockInput) => {
      const { id, ...updates } = input
      const res = await api.api.schedule['time-blocks'][':id'].$patch({
        param: { id },
        json: updates,
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: timeBlockKeys.all })

      const previousData = queryClient.getQueriesData<TimeBlock[]>({
        queryKey: timeBlockKeys.all,
      })

      queryClient.setQueriesData<TimeBlock[]>(
        { queryKey: timeBlockKeys.all },
        (old) => {
          if (!old) return old
          return old.map((block) => {
            if (block.id !== input.id) return block
            return {
              ...block,
              ...(input.startTime !== undefined
                ? { startTime: input.startTime }
                : {}),
              ...(input.endTime !== undefined
                ? { endTime: input.endTime }
                : {}),
              ...(input.isAutoScheduled !== undefined
                ? { isAutoScheduled: input.isAutoScheduled }
                : {}),
              updatedAt: new Date().toISOString(),
            }
          })
        },
      )

      return { previousData }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        for (const [key, data] of context.previousData) {
          queryClient.setQueryData(key, data)
        }
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: timeBlockKeys.all })
    },
  })
}

export function useDeleteTimeBlock() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.schedule['time-blocks'][':id'].$delete({
        param: { id },
      })
      // eslint-disable-next-line neverthrow/must-use-result -- unwrapOrThrow already handles the Result (throws on Err); the plugin can't see through a custom wrapper
      unwrapOrThrow(assertOk(res))
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: timeBlockKeys.all })

      const previousData = queryClient.getQueriesData<TimeBlock[]>({
        queryKey: timeBlockKeys.all,
      })

      queryClient.setQueriesData<TimeBlock[]>(
        { queryKey: timeBlockKeys.all },
        (old) => {
          if (!old) return old
          return old.filter((block) => block.id !== id)
        },
      )

      return { previousData }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        for (const [key, data] of context.previousData) {
          queryClient.setQueryData(key, data)
        }
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: timeBlockKeys.all })
    },
  })
}
