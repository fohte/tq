import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import { api } from '#lib/api'
import { assertOk, assertOkOrThrow, unwrapOrThrow } from '#lib/assert-response'

export type RecurringTemplate = InferResponseType<
  (typeof api.api)['recurring-task-templates'][':id']['$get'],
  200
>

export interface RecurringTemplateFilter {
  context?: 'work' | 'personal'
  enabled?: boolean
}

const recurringTemplateKeys = {
  all: ['recurring-templates'] as const,
  lists: ['recurring-templates', 'list'] as const,
  list: (filter?: RecurringTemplateFilter) =>
    [...recurringTemplateKeys.lists, filter] as const,
  detail: (id: string) => [...recurringTemplateKeys.all, 'detail', id] as const,
}

export function useRecurringTemplates(filter?: RecurringTemplateFilter) {
  return useQuery({
    queryKey: recurringTemplateKeys.list(filter),
    queryFn: async () => {
      const res = await api.api['recurring-task-templates'].$get({
        query: {
          context: filter?.context,
          enabled:
            filter?.enabled === true
              ? 'true'
              : filter?.enabled === false
                ? 'false'
                : undefined,
        },
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
  })
}

export function useRecurringTemplate(id: string) {
  return useQuery({
    queryKey: recurringTemplateKeys.detail(id),
    queryFn: async () => {
      const res = await api.api['recurring-task-templates'][':id'].$get({
        param: { id },
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
  })
}

export interface UpdateRecurringTemplateInput {
  title?: string
  description?: string | null
  estimatedMinutes?: number | null
  projectId?: string | null
  parentId?: string | null
  context?: 'work' | 'personal'
  labels?: string[]
  recurrenceRule?: {
    type: 'daily' | 'weekly' | 'monthly' | 'custom'
    interval: number
    daysOfWeek?: number[]
    dayOfMonth?: number
  }
  startOffsetDays?: number | null
  anchorDate?: string
  enabled?: boolean
}

function applyUpdateInput(
  template: RecurringTemplate,
  input: UpdateRecurringTemplateInput,
): RecurringTemplate {
  const { recurrenceRule, ...rest } = input
  return {
    ...template,
    ...rest,
    ...(recurrenceRule != null
      ? {
          recurrenceRule: {
            id: template.recurrenceRule.id,
            type: recurrenceRule.type,
            interval: recurrenceRule.interval,
            daysOfWeek: recurrenceRule.daysOfWeek ?? null,
            dayOfMonth: recurrenceRule.dayOfMonth ?? null,
          },
        }
      : {}),
    updatedAt: new Date().toISOString(),
  }
}

export function useUpdateRecurringTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string
      input: UpdateRecurringTemplateInput
    }) => {
      const res = await api.api['recurring-task-templates'][':id'].$patch({
        param: { id },
        json: input,
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({
        queryKey: recurringTemplateKeys.detail(id),
      })
      await queryClient.cancelQueries({ queryKey: recurringTemplateKeys.lists })

      const previousDetail = queryClient.getQueryData<RecurringTemplate>(
        recurringTemplateKeys.detail(id),
      )
      const previousLists = queryClient.getQueriesData<RecurringTemplate[]>({
        queryKey: recurringTemplateKeys.lists,
      })

      if (previousDetail) {
        queryClient.setQueryData<RecurringTemplate>(
          recurringTemplateKeys.detail(id),
          applyUpdateInput(previousDetail, input),
        )
      }

      queryClient.setQueriesData<RecurringTemplate[]>(
        { queryKey: recurringTemplateKeys.lists },
        (old) =>
          old?.map((template) =>
            template.id === id ? applyUpdateInput(template, input) : template,
          ),
      )

      return { previousDetail, previousLists }
    },
    onError: (_err, { id }, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(
          recurringTemplateKeys.detail(id),
          context.previousDetail,
        )
      }
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          queryClient.setQueryData(key, data)
        }
      }
    },
    onSettled: (_data, _err, { id }) => {
      void queryClient.invalidateQueries({
        queryKey: recurringTemplateKeys.detail(id),
      })
      void queryClient.invalidateQueries({
        queryKey: recurringTemplateKeys.lists,
      })
    },
  })
}

export function useDeleteRecurringTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api['recurring-task-templates'][':id'].$delete({
        param: { id },
      })
      assertOkOrThrow(res)
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: recurringTemplateKeys.lists })

      const previousLists = queryClient.getQueriesData<RecurringTemplate[]>({
        queryKey: recurringTemplateKeys.lists,
      })

      queryClient.setQueriesData<RecurringTemplate[]>(
        { queryKey: recurringTemplateKeys.lists },
        (old) => {
          if (!old) return old
          return old.filter((template) => template.id !== id)
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
      void queryClient.invalidateQueries({
        queryKey: recurringTemplateKeys.lists,
      })
    },
  })
}
