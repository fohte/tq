import { useQuery } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'
import { useMemo } from 'react'

import { api } from '#lib/api'
import { assertOk } from '#lib/assert-response'

type Task = InferResponseType<typeof api.api.tasks.$get>[number]

type TaskDetail = InferResponseType<(typeof api.api.tasks)[':id']['$get'], 200>

type LinkedTaskSummary = TaskDetail['links']['outgoing'][number]

type TreeNode = InferResponseType<typeof api.api.tasks.tree.$get, 200>[number]

export const taskKeys = {
  all: ['tasks'] as const,
  lists: ['tasks', 'list'] as const,
  list: (filter?: { status?: string; context?: string; parentId?: string }) =>
    [...taskKeys.lists, filter] as const,
  tree: ['tasks', 'tree'] as const,
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
}

export type { LinkedTaskSummary, Task, TaskDetail, TreeNode }

type TaskStatus = 'todo' | 'in_progress' | 'completed'

function isBacklog(t: Task): boolean {
  return t.status === 'todo' && t.dueDate == null && t.startDate == null
}

export interface CategorizedTasks {
  /** All tasks from the API */
  all: Task[]
  /** Non-completed, non-backlog tasks */
  open: Task[]
  /** Tasks with no date and status=todo */
  backlog: Task[]
  /** Non-backlog tasks (for header stats: includes completed) */
  nonBacklog: Task[]
}

type TaskContext = 'work' | 'personal'

export function useTaskList(filter?: {
  status?: TaskStatus
  context?: TaskContext
  parentId?: string
}) {
  const query = useQuery({
    queryKey: taskKeys.list(filter),
    queryFn: async () => {
      const res = await api.api.tasks.$get({
        query: filter ?? {},
      })
      assertOk(res)
      return res.json()
    },
  })

  const categorized = useMemo((): CategorizedTasks => {
    const all = query.data ?? []
    const backlog = all.filter(isBacklog)
    const backlogIds = new Set(backlog.map((t) => t.id))
    const open = all.filter(
      (t) => t.status !== 'completed' && !backlogIds.has(t.id),
    )
    const nonBacklog = all.filter((t) => !backlogIds.has(t.id))
    return { all, open, backlog, nonBacklog }
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
      if (!res.ok) throw new Error('Failed to fetch task')
      return res.json()
    },
  })
}

export function useTaskTree(options: { enabled: boolean }) {
  return useQuery({
    queryKey: taskKeys.tree,
    queryFn: async () => {
      const res = await api.api.tasks.tree.$get({ query: {} })
      assertOk(res)
      return res.json()
    },
    enabled: options.enabled,
  })
}
