import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'

import type { Task } from '#hooks/use-task-queries'
import { api } from '#lib/api'
import { assertOk, unwrapOrThrow } from '#lib/assert-response'

type Project = InferResponseType<typeof api.api.projects.$get, 200>[number]

type ProjectDetail = InferResponseType<
  (typeof api.api.projects)[':id']['$get'],
  200
>

type ProjectTask = Task

export type { Project, ProjectDetail, ProjectTask }

type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived'

export const PROJECT_COLOR_PRESETS = [
  { name: 'Orange', hex: '#FF8400' },
  { name: 'Red', hex: '#FF5C33' },
  { name: 'Green', hex: '#4CAF50' },
  { name: 'Blue', hex: '#4A90D9' },
  { name: 'Purple', hex: '#9B59B6' },
  { name: 'Teal', hex: '#26A69A' },
  { name: 'Pink', hex: '#E91E63' },
  { name: 'Yellow', hex: '#FFC107' },
] as const

export const projectKeys = {
  all: ['projects'] as const,
  lists: ['projects', 'list'] as const,
  list: (filter?: { status?: string }) =>
    [...projectKeys.lists, filter] as const,
  detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
  taskIds: (id: string) => [...projectKeys.detail(id), 'task-ids'] as const,
}

export function useProjects(
  filter?: { status?: ProjectStatus },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: projectKeys.list(filter),
    queryFn: async () => {
      const res = await api.api.projects.$get({
        query: filter ?? {},
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    enabled: options?.enabled ?? true,
  })
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: async () => {
      const res = await api.api.projects[':id'].$get({
        param: { id },
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
  })
}

export function useProjectTaskIds(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: projectKeys.taskIds(id),
    queryFn: async () => {
      const res = await api.api.projects[':id']['task-ids'].$get({
        param: { id },
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    enabled: options?.enabled ?? true,
  })
}

export interface CreateProjectInput {
  title: string
  description?: string
  status?: ProjectStatus
  startDate?: string
  targetDate?: string
  color?: string
  context?: 'work' | 'personal'
}

export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      const res = await api.api.projects.$post({
        json: input,
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.lists })

      const previousLists = queryClient.getQueriesData<Project[]>({
        queryKey: projectKeys.lists,
      })

      const now = new Date().toISOString()
      const optimisticProject: Project = {
        id: `optimistic-${String(Date.now())}`,
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? 'active',
        startDate: input.startDate ?? null,
        targetDate: input.targetDate ?? null,
        color: input.color ?? null,
        sortOrder: 0,
        context: input.context ?? 'personal',
        createdAt: now,
        updatedAt: now,
        completionRate: 0,
        taskCount: { total: 0, completed: 0 },
      }

      queryClient.setQueriesData<Project[]>(
        { queryKey: projectKeys.lists },
        (old) => {
          if (!old) return [optimisticProject]
          return [optimisticProject, ...old]
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
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

export interface UpdateProjectInput {
  title?: string
  description?: string | null
  status?: ProjectStatus
  startDate?: string | null
  targetDate?: string | null
  color?: string | null
  context?: 'work' | 'personal'
}

export function useUpdateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string
      input: UpdateProjectInput
    }) => {
      const res = await api.api.projects[':id'].$patch({
        param: { id },
        json: input,
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.detail(id) })
      await queryClient.cancelQueries({ queryKey: projectKeys.lists })

      const previousDetail = queryClient.getQueryData<ProjectDetail>(
        projectKeys.detail(id),
      )
      const previousLists = queryClient.getQueriesData<Project[]>({
        queryKey: projectKeys.lists,
      })

      const optimisticTimestamp = new Date().toISOString()

      if (previousDetail) {
        queryClient.setQueryData<ProjectDetail>(projectKeys.detail(id), {
          ...previousDetail,
          ...input,
          updatedAt: optimisticTimestamp,
        })
      }

      queryClient.setQueriesData<Project[]>(
        { queryKey: projectKeys.lists },
        (old) => {
          if (!old) return old
          return old.map((project) =>
            project.id === id
              ? { ...project, ...input, updatedAt: optimisticTimestamp }
              : project,
          )
        },
      )

      return { previousDetail, previousLists }
    },
    onError: (_err, { id }, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(projectKeys.detail(id), context.previousDetail)
      }
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          queryClient.setQueryData(key, data)
        }
      }
    },
    onSettled: (_data, _err, { id }) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}
