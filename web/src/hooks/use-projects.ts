import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import { assertOk } from '@web/lib/assert-response'
import type { InferResponseType } from 'hono/client'

type Project = InferResponseType<typeof api.api.projects.$get, 200>[number]

type ProjectDetail = InferResponseType<
  (typeof api.api.projects)[':id']['$get'],
  200
>

type ProjectTask = InferResponseType<
  (typeof api.api.projects)[':id']['tasks']['$get'],
  200
>[number]

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
  tasks: (id: string) => [...projectKeys.all, 'tasks', id] as const,
}

export function useProjects(filter?: { status?: ProjectStatus }) {
  return useQuery({
    queryKey: projectKeys.list(filter),
    queryFn: async () => {
      const res = await api.api.projects.$get({
        query: filter ?? {},
      })
      assertOk(res)
      return res.json()
    },
  })
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: async () => {
      const res = await api.api.projects[':id'].$get({
        param: { id },
      })
      if (!res.ok) throw new Error('Failed to fetch project')
      return res.json()
    },
  })
}

export function useProjectTasks(id: string) {
  return useQuery({
    queryKey: projectKeys.tasks(id),
    queryFn: async () => {
      const res = await api.api.projects[':id'].tasks.$get({
        param: { id },
      })
      if (!res.ok) throw new Error('Failed to fetch project tasks')
      return res.json()
    },
  })
}

export interface CreateProjectInput {
  title: string
  description?: string
  status?: ProjectStatus
  startDate?: string
  targetDate?: string
  color?: string
}

export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      const res = await api.api.projects.$post({
        json: input,
      })
      if (!res.ok) throw new Error('Failed to create project')
      return res.json()
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
        createdAt: now,
        updatedAt: now,
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
      if (!res.ok) throw new Error('Failed to update project')
      return res.json()
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

export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.projects[':id'].$delete({
        param: { id },
      })
      if (!res.ok) throw new Error('Failed to delete project')
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.lists })

      const previousLists = queryClient.getQueriesData<Project[]>({
        queryKey: projectKeys.lists,
      })

      queryClient.setQueriesData<Project[]>(
        { queryKey: projectKeys.lists },
        (old) => {
          if (!old) return old
          return old.filter((project) => project.id !== id)
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
