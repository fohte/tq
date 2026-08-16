import { useQuery } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'
import { useMemo } from 'react'

import { api } from '#lib/api'
import { assertOk, unwrapOrThrow } from '#lib/assert-response'

type Task = InferResponseType<typeof api.api.tasks.$get>[number]

type TaskDetail = InferResponseType<(typeof api.api.tasks)[':id']['$get'], 200>

type LinkedTaskSummary = TaskDetail['links']['outgoing'][number]

type TaskStatus = 'todo' | 'in_progress' | 'completed'

type TaskContext = 'work' | 'personal'

export type TaskSortBy = 'created' | 'updated'

export interface TaskListFilter {
  q?: string
  status?: TaskStatus | TaskStatus[]
  context?: TaskContext
  parentId?: string
  label?: string
  projectId?: string
  sortBy?: TaskSortBy
  includeAncestors?: boolean
}

export const taskKeys = {
  all: ['tasks'] as const,
  lists: ['tasks', 'list'] as const,
  list: (filter?: TaskListFilter) => [...taskKeys.lists, filter] as const,
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
}

export type { LinkedTaskSummary, Task, TaskDetail }

export interface CategorizedTasks {
  /** All tasks from the API */
  all: Task[]
}

export function useTaskList(
  filter?: TaskListFilter,
  options?: { enabled?: boolean },
) {
  const query = useQuery({
    queryKey: taskKeys.list(filter),
    queryFn: async () => {
      const res = await api.api.tasks.$get({
        query: {
          ...filter,
          includeAncestors:
            filter?.includeAncestors === true ? 'true' : undefined,
        },
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    enabled: options?.enabled ?? true,
  })

  const categorized = useMemo((): CategorizedTasks => {
    const all = query.data ?? []
    return { all }
  }, [query.data])

  return { ...query, categorized }
}

export function useTaskMap(tasks: Task[]): Map<string, Task> {
  return useMemo(() => {
    const map = new Map<string, Task>()
    for (const task of tasks) {
      map.set(task.id, task)
    }
    return map
  }, [tasks])
}

export function useTask(id: string) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: async () => {
      const res = await api.api.tasks[':id'].$get({
        param: { id },
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
  })
}
