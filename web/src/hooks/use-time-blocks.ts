import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { taskKeys } from '#hooks/use-tasks'
import { api } from '#lib/api'
import { assertOk, assertOkOrThrow, unwrapOrThrow } from '#lib/assert-response'

type TimeBlock = InferResponseType<
  (typeof api.api.schedule)['time-blocks']['$get']
>[number]

export type { TimeBlock }

export const timeBlockKeys = {
  all: ['time-blocks'] as const,
  list: (startDate: string, endDate: string) =>
    [...timeBlockKeys.all, 'list', { startDate, endDate }] as const,
}

export function useTimeBlocks(startDate: string, endDate: string) {
  return useQuery({
    queryKey: timeBlockKeys.list(startDate, endDate),
    queryFn: async () => {
      const res = await api.api.schedule['time-blocks'].$get({
        query: {
          startDate,
          endDate,
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
      await queryClient.cancelQueries({ queryKey: timeBlockKeys.all })

      // Only the mounted (active) query is updated; other cached ranges
      // are refreshed by onSettled's invalidation.
      const activeQueries = queryClient
        .getQueryCache()
        .findAll({ queryKey: timeBlockKeys.all, type: 'active' })

      const previousData = activeQueries.map(
        (query) =>
          [
            query.queryKey,
            queryClient.getQueryData<TimeBlock[]>(query.queryKey),
          ] as const,
      )

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

      for (const query of activeQueries) {
        queryClient.setQueryData<TimeBlock[]>(query.queryKey, (old = []) =>
          [...old, optimisticBlock].sort(
            (a, b) =>
              new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
          ),
        )
      }

      return { previousData }
    },
    onError: (_err, _vars, context) => {
      context?.previousData.forEach(([key, data]) => {
        if (data !== undefined) {
          queryClient.setQueryData(key, data)
        }
      })
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
      assertOkOrThrow(res)
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

export function useDeleteManualTimeBlock(taskId: string, blockId: string) {
  const queryClient = useQueryClient()
  const deleteTimeBlock = useDeleteTimeBlock()

  return {
    onDelete: () => {
      deleteTimeBlock.mutate(blockId, {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: taskKeys.detail(taskId),
          })
        },
      })
    },
    isDeleting: deleteTimeBlock.isPending,
  }
}
