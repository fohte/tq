import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'
import { useMemo } from 'react'

import { api } from '#lib/api'
import { assertOk, unwrapOrThrow } from '#lib/assert-response'
import { taskKeys } from '#lib/query-keys'

export { taskKeys }

type TaskListResponse = InferResponseType<typeof api.api.tasks.$get>
type TaskListResponseItem = TaskListResponse[number]
export type TaskWithDescription = TaskListResponseItem & {
  description: string | null
}
type Task = Omit<TaskWithDescription, 'description'>
type TaskRow = Task
export type TaskListView = 'row' | 'full'
type TaskForView<View extends TaskListView> = View extends 'full'
  ? TaskWithDescription
  : TaskRow

type TaskDetail = InferResponseType<(typeof api.api.tasks)[':id']['$get'], 200>

type LinkedTaskSummary = TaskDetail['links']['outgoing'][number]
export type BlockedByGithubRef = Task['blockedByGithubRefs'][number]

type TaskStatus = 'todo' | 'completed'

export type TaskContext = 'work' | 'personal'
type TaskListContext = TaskContext | 'all'

export type TaskSortBy = 'created' | 'updated' | 'due'
type TaskSortOrder = 'asc' | 'desc'

export type TaskCommitment = 'inbox' | 'active' | 'someday'

type TaskListFilterOptions = {
  ids?: string[]
  q?: string
  status: TaskStatus | 'all' | TaskStatus[]
  includeMatch?: boolean
  hasDue?: boolean
  dateFrom?: string
  dateTo?: string
  dueTo?: string
  candidatesOn?: string
  context: TaskListContext
  commitment?: TaskCommitment
  parentId?: string
  templateId?: string
  descendantOf?: string
  label?: string
  projectId?: string
  sortBy?: TaskSortBy
  order?: TaskSortOrder
  includeAncestors?: boolean
  limit: number | 'unlimited'
  offset?: number
}

export type TaskListFilter<View extends TaskListView = TaskListView> =
  TaskListFilterOptions & { view: View }

type TaskListQueryKey<View extends TaskListView> = readonly [
  ...typeof taskKeys.lists,
  TaskListFilter<View>,
]

export const allTasksFilter = {
  view: 'row',
  context: 'all',
  status: 'all',
  limit: 'unlimited',
} as const satisfies TaskListFilter

export type InfiniteTaskListFilter<View extends TaskListView = TaskListView> =
  Omit<TaskListFilter<View>, 'limit'>

export interface TaskCountFilter {
  context: TaskListContext
  status: TaskStatus | 'all' | TaskStatus[]
  commitment?: TaskCommitment
}

const TASK_LIST_PAGE_SIZE = 50

export type { LinkedTaskSummary, Task, TaskDetail }

export interface CategorizedTasks<
  TaskItem extends Task | TaskWithDescription = Task,
> {
  /** All tasks from the API */
  all: TaskItem[]
}

export async function fetchTaskList<View extends TaskListView>(
  filter: TaskListFilter<View>,
): Promise<TaskForView<View>[]> {
  const { limit, offset, hasDue, includeMatch, includeAncestors, ...rest } =
    filter
  const res = await api.api.tasks.$get({
    query: {
      ...rest,
      ...(includeMatch === true ? { includeMatch: 'true' } : {}),
      ...(hasDue == null ? {} : { hasDue: String(hasDue) }),
      ...(includeAncestors === true ? { includeAncestors: 'true' } : {}),
      limit: String(limit),
      ...(offset != null ? { offset: String(offset) } : {}),
    },
  })
  return (
    unwrapOrThrow(assertOk(res))
      .json()
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- The required request view selects the matching response array; Hono exposes both variants as a union.
      .then((response) => response as TaskForView<View>[])
  )
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

export function useTaskList<View extends TaskListView>(
  filter: TaskListFilter<View>,
  options?: {
    enabled?: boolean
    placeholderData?: (
      previousData: TaskForView<View>[] | undefined,
      previousFilter: TaskListFilter<View> | undefined,
    ) => TaskForView<View>[] | undefined
  },
) {
  const query = useQuery<
    TaskForView<View>[],
    Error,
    TaskForView<View>[],
    TaskListQueryKey<View>
  >({
    queryKey: taskKeys.list(filter),
    queryFn: () => fetchTaskList(filter),
    enabled: options?.enabled ?? true,
    ...(options?.placeholderData == null
      ? {}
      : {
          placeholderData: (
            previousData: TaskForView<View>[] | undefined,
            previousQuery,
          ) => {
            const previousFilter = previousQuery?.queryKey[2]
            const sameView = previousFilter?.view === filter.view
            return options.placeholderData?.(
              sameView ? previousData : undefined,
              sameView ? previousFilter : undefined,
            )
          },
        }),
  })

  const categorized = useMemo((): CategorizedTasks<TaskForView<View>> => {
    const all = query.data ?? []
    return { all }
  }, [query.data])

  return { ...query, categorized }
}

export function useSelfAndDescendantIds(taskId: string, enabled: boolean) {
  const { categorized } = useTaskList(
    { ...allTasksFilter, descendantOf: taskId },
    { enabled },
  )

  return useMemo(
    () => new Set([taskId, ...categorized.all.map((task) => task.id)]),
    [taskId, categorized.all],
  )
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
export function useInfiniteTaskList<View extends TaskListView>(
  filter: InfiniteTaskListFilter<View>,
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
