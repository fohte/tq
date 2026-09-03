import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'
import { useMemo } from 'react'

import { api } from '#lib/api'
import { assertOk, unwrapOrThrow } from '#lib/assert-response'

type Task = InferResponseType<typeof api.api.tasks.$get>[number]

type TaskDetail = InferResponseType<(typeof api.api.tasks)[':id']['$get'], 200>

type LinkedTaskSummary = TaskDetail['links']['outgoing'][number]

type TaskStatus = 'todo' | 'completed'

type TaskContext = 'work' | 'personal'

export type TaskSortBy = 'created' | 'updated' | 'due' | 'estimate'

export type TaskCommitment = 'inbox' | 'active' | 'someday'

export interface TaskListFilter {
  q?: string
  status?: TaskStatus | TaskStatus[]
  context?: TaskContext
  commitment?: TaskCommitment
  parentId?: string
  label?: string
  projectId?: string
  sortBy?: TaskSortBy
  includeAncestors?: boolean
  limit?: number
  offset?: number
}

export const TASK_LIST_PAGE_SIZE = 50

// infiniteLists deliberately isn't nested under `lists`: use-task-mutations.ts
// runs optimistic updates against every `lists`-prefixed cache entry assuming
// each holds a Task[], but an infinite query's cache entry is an InfiniteData
// object instead, so a shared prefix would make those updates throw.
export const taskKeys = {
  all: ['tasks'] as const,
  lists: ['tasks', 'list'] as const,
  list: (filter?: TaskListFilter) => [...taskKeys.lists, filter] as const,
  infiniteLists: ['tasks', 'infinite-list'] as const,
  infiniteList: (filter?: TaskListFilter) =>
    [...taskKeys.infiniteLists, filter] as const,
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
}

export type { LinkedTaskSummary, Task, TaskDetail }

export interface CategorizedTasks {
  /** All tasks from the API */
  all: Task[]
}

export async function fetchTaskList(filter?: TaskListFilter): Promise<Task[]> {
  const { limit, offset, ...rest } = filter ?? {}
  const res = await api.api.tasks.$get({
    query: {
      ...rest,
      includeAncestors: rest.includeAncestors === true ? 'true' : undefined,
      ...(limit != null ? { limit: String(limit) } : {}),
      ...(offset != null ? { offset: String(offset) } : {}),
    },
  })
  return unwrapOrThrow(assertOk(res)).json()
}

export function useTaskList(
  filter?: TaskListFilter,
  options?: { enabled?: boolean },
) {
  const query = useQuery({
    queryKey: taskKeys.list(filter),
    queryFn: () => fetchTaskList(filter),
    enabled: options?.enabled ?? true,
  })

  const categorized = useMemo((): CategorizedTasks => {
    const all = query.data ?? []
    return { all }
  }, [query.data])

  return { ...query, categorized }
}

/**
 * Paginates a task list `limit`/`offset` at a time, loading further pages
 * via `fetchNextPage`. Pages are flattened and de-duped by id before being
 * returned as `tasks`: offset pagination can return the same task twice
 * across pages if a task is inserted or removed between page fetches, and
 * tree-builder.ts would otherwise render it as two rows.
 */
export function useInfiniteTaskList(
  filter?: TaskListFilter,
  options?: { enabled?: boolean },
) {
  const query = useInfiniteQuery({
    queryKey: taskKeys.infiniteList(filter),
    queryFn: ({ pageParam }) =>
      fetchTaskList({
        ...filter,
        limit: TASK_LIST_PAGE_SIZE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.length < TASK_LIST_PAGE_SIZE
        ? undefined
        : lastPageParam + TASK_LIST_PAGE_SIZE,
    enabled: options?.enabled ?? true,
  })

  const tasks = useMemo(() => {
    const byId = new Map(
      query.data?.pages.flat().map((task) => [task.id, task]),
    )
    return [...byId.values()]
  }, [query.data])

  return { ...query, tasks }
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

export function useTask(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: async () => {
      const res = await api.api.tasks[':id'].$get({
        param: { id },
      })
      return unwrapOrThrow(assertOk(res)).json()
    },
    enabled: options?.enabled ?? true,
  })
}
