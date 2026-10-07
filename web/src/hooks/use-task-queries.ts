import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'
import { useMemo } from 'react'

import { api } from '#lib/api'
import { assertOk, unwrapOrThrow } from '#lib/assert-response'
import { taskKeys } from '#lib/query-keys'

export { taskKeys }

type Task = InferResponseType<typeof api.api.tasks.$get>[number]

type TaskDetail = InferResponseType<(typeof api.api.tasks)[':id']['$get'], 200>

type LinkedTaskSummary = TaskDetail['links']['outgoing'][number]
export type BlockedByGithubRef = Task['blockedByGithubRefs'][number]

type TaskStatus = 'todo' | 'completed'

export type TaskContext = 'work' | 'personal'

export type TaskSortBy = 'created' | 'updated' | 'due'

export type TaskCommitment = 'inbox' | 'active' | 'someday'

export interface TaskListFilter {
  q?: string
  status?: TaskStatus | TaskStatus[]
  hasDue?: boolean
  context?: TaskContext
  commitment?: TaskCommitment
  parentId?: string
  templateId?: string
  label?: string
  projectId?: string
  sortBy?: TaskSortBy
  includeAncestors?: boolean
  limit?: number
  offset?: number
}

export interface TaskCountFilter {
  context: TaskContext
  status?: TaskStatus | TaskStatus[]
  commitment?: TaskCommitment
}

const TASK_LIST_PAGE_SIZE = 50

export type { LinkedTaskSummary, Task, TaskDetail }

export interface CategorizedTasks {
  /** All tasks from the API */
  all: Task[]
}

export async function fetchTaskList(filter?: TaskListFilter): Promise<Task[]> {
  const { limit, offset, hasDue, ...rest } = filter ?? {}
  const res = await api.api.tasks.$get({
    query: {
      ...rest,
      hasDue: hasDue == null ? undefined : String(hasDue),
      includeAncestors: rest.includeAncestors === true ? 'true' : undefined,
      ...(limit != null ? { limit: String(limit) } : {}),
      ...(offset != null ? { offset: String(offset) } : {}),
    },
  })
  return unwrapOrThrow(assertOk(res)).json()
}

async function fetchTaskCount(filter: TaskCountFilter): Promise<number> {
  const res = await api.api.tasks.count.$get({ query: filter })
  return unwrapOrThrow(assertOk(res))
    .json()
    .then((body) => body.count)
}

export async function fetchTaskDetail(id: string): Promise<TaskDetail> {
  const res = await api.api.tasks[':id'].$get({
    param: { id },
  })
  return unwrapOrThrow(assertOk(res)).json()
}

export function useTaskList(
  filter?: TaskListFilter,
  options?: { enabled?: boolean; refetchInterval?: number },
) {
  const query = useQuery({
    queryKey: taskKeys.list(filter),
    queryFn: () => fetchTaskList(filter),
    enabled: options?.enabled ?? true,
    ...(options?.refetchInterval === undefined
      ? {}
      : { refetchInterval: options.refetchInterval }),
  })

  const categorized = useMemo((): CategorizedTasks => {
    const all = query.data ?? []
    return { all }
  }, [query.data])

  return { ...query, categorized }
}

export function useTaskCount(
  filter: TaskCountFilter,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: taskKeys.count(filter),
    queryFn: () => fetchTaskCount(filter),
    enabled: options?.enabled ?? true,
  })
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
    queryFn: () => fetchTaskDetail(id),
    enabled: options?.enabled ?? true,
  })
}
