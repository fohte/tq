import type {
  SortOption,
  StatusFilter,
} from '@web/components/project/project-filter-bar'
import { TaskRow } from '@web/components/task/task-row'
import type { ProjectTask } from '@web/hooks/use-projects'
import type { Task } from '@web/hooks/use-tasks'
import { useMemo } from 'react'

interface TreeNode {
  task: ProjectTask
  children: TreeNode[]
  depth: number
}

function buildTaskTree(tasks: ProjectTask[]): TreeNode[] {
  const taskMap = new Map<string, ProjectTask>()
  for (const task of tasks) {
    taskMap.set(task.id, task)
  }

  const childrenMap = new Map<string, ProjectTask[]>()
  const roots: ProjectTask[] = []

  for (const task of tasks) {
    if (task.parentId != null && taskMap.has(task.parentId)) {
      const siblings = childrenMap.get(task.parentId) ?? []
      siblings.push(task)
      childrenMap.set(task.parentId, siblings)
    } else {
      roots.push(task)
    }
  }

  function buildNode(task: ProjectTask, depth: number): TreeNode {
    const children = (childrenMap.get(task.id) ?? []).map((child) =>
      buildNode(child, depth + 1),
    )
    return { task, children, depth }
  }

  return roots.map((task) => buildNode(task, 0))
}

function flattenTree(
  nodes: TreeNode[],
): Array<{ task: ProjectTask; depth: number }> {
  const result: Array<{ task: ProjectTask; depth: number }> = []
  for (const node of nodes) {
    result.push({ task: node.task, depth: node.depth })
    result.push(...flattenTree(node.children))
  }
  return result
}

export function filterTasks(
  tasks: ProjectTask[],
  statusFilter: StatusFilter,
): ProjectTask[] {
  if (statusFilter === 'all') return tasks
  return tasks.filter((t) => t.status === statusFilter)
}

export function sortTasks(
  tasks: ProjectTask[],
  sortOption: SortOption,
): ProjectTask[] {
  if (sortOption === 'manual') return tasks
  const sorted = [...tasks]
  sorted.sort((a, b) => {
    switch (sortOption) {
      case 'due': {
        if (a.dueDate == null && b.dueDate == null) return 0
        if (a.dueDate == null) return 1
        if (b.dueDate == null) return -1
        return a.dueDate.localeCompare(b.dueDate)
      }
      case 'created':
        return a.createdAt.localeCompare(b.createdAt)
      case 'updated':
        return b.updatedAt.localeCompare(a.updatedAt)
      default:
        return 0
    }
  })
  return sorted
}

function projectTaskToTask(pt: ProjectTask): Task {
  return {
    ...pt,
    activeTimeBlockStartTime: null,
  }
}

export function ProjectTaskList({
  tasks,
  statusFilter,
  sortOption,
}: {
  tasks: ProjectTask[]
  statusFilter: StatusFilter
  sortOption: SortOption
}) {
  const flat = useMemo(() => {
    const filtered = filterTasks(tasks, statusFilter)
    const sorted = sortTasks(filtered, sortOption)
    const tree = buildTaskTree(sorted)
    return flattenTree(tree)
  }, [tasks, statusFilter, sortOption])

  if (flat.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No tasks
      </div>
    )
  }

  return (
    <div className="py-1" data-testid="project-task-list">
      {flat.map(({ task, depth }) => (
        <div key={task.id} style={{ paddingLeft: `${String(depth * 24)}px` }}>
          <TaskRow task={projectTaskToTask(task)} />
        </div>
      ))}
    </div>
  )
}
