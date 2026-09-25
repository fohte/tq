import { useMatchRoute } from '@tanstack/react-router'

export type CurrentRoute =
  | { kind: 'task-detail'; taskId: string }
  | { kind: 'project-detail'; projectId: string }
  | { kind: 'task-list' }
  | { kind: 'other' }

export function useCurrentRoute(): CurrentRoute {
  const matchRoute = useMatchRoute()
  const taskMatch = matchRoute({ to: '/tasks/$taskId', fuzzy: true })

  if (taskMatch !== false) {
    return { kind: 'task-detail', taskId: taskMatch.taskId }
  }

  const projectMatch = matchRoute({ to: '/projects/$projectId', fuzzy: false })

  if (projectMatch !== false) {
    return { kind: 'project-detail', projectId: projectMatch.projectId }
  }

  const taskListMatch = matchRoute({ to: '/tasks', fuzzy: false })

  if (taskListMatch !== false) {
    return { kind: 'task-list' }
  }

  return { kind: 'other' }
}
