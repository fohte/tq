import { useQuery } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import { assertOk } from '@web/lib/assert-response'
import type { InferResponseType } from 'hono/client'

export type Project = InferResponseType<
  typeof api.api.projects.$get,
  200
>[number]

export type ProjectDetail = InferResponseType<
  (typeof api.api.projects)[':id']['$get'],
  200
>

export type ProjectTask = InferResponseType<
  (typeof api.api.projects)[':id']['tasks']['$get'],
  200
>[number]

export const projectKeys = {
  all: ['projects'] as const,
  list: (filter?: { status?: string }) =>
    [...projectKeys.all, 'list', filter] as const,
  detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
  tasks: (id: string) => [...projectKeys.all, 'tasks', id] as const,
}

export function useProjects(filter?: {
  status?: 'active' | 'paused' | 'completed' | 'archived'
}) {
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
