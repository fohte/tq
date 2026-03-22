import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import type { InferResponseType } from 'hono/client'

type TimeBlock = InferResponseType<
  (typeof api.api.schedule)['time-blocks']['$get']
>[number]

export type { TimeBlock }

const timeBlockKeys = {
  all: ['time-blocks'] as const,
  list: (date: string) => [...timeBlockKeys.all, 'list', date] as const,
}

export function useTimeBlocks(date: string) {
  return useQuery({
    queryKey: timeBlockKeys.list(date),
    queryFn: async () => {
      const res = await api.api.schedule['time-blocks'].$get({
        query: { date },
      })
      if (!res.ok) throw new Error('Failed to fetch time blocks')
      return res.json()
    },
  })
}

export interface CreateTimeBlockInput {
  taskId: string
  startTime: string
  endTime: string | null
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
      if (!res.ok) throw new Error('Failed to create time block')
      return res.json()
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: timeBlockKeys.all })

      const previousData = queryClient.getQueriesData<TimeBlock[]>({
        queryKey: timeBlockKeys.all,
      })

      const now = new Date().toISOString()
      const optimisticBlock: TimeBlock = {
        id: `optimistic-${Date.now()}`,
        taskId: input.taskId,
        startTime: input.startTime,
        endTime: input.endTime,
        isAutoScheduled: false,
        createdAt: now,
        updatedAt: now,
      }

      queryClient.setQueriesData<TimeBlock[]>(
        { queryKey: timeBlockKeys.all },
        (old) => {
          if (!old) return [optimisticBlock]
          return [...old, optimisticBlock]
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
      queryClient.invalidateQueries({ queryKey: timeBlockKeys.all })
    },
  })
}

export interface UpdateTimeBlockInput {
  id: string
  startTime?: string
  endTime?: string | null
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
      if (!res.ok) throw new Error('Failed to update time block')
      return res.json()
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
      queryClient.invalidateQueries({ queryKey: timeBlockKeys.all })
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
      if (!res.ok) throw new Error('Failed to delete time block')
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
      queryClient.invalidateQueries({ queryKey: timeBlockKeys.all })
    },
  })
}
