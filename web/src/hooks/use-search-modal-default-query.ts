import { useSearch } from '@tanstack/react-router'

import { extractSearchScopeTokens } from '#components/search/search-modal-query'
import { useCurrentRoute } from '#hooks/use-current-route'
import { useTask } from '#hooks/use-tasks'

export function useSearchModalDefaultQuery(): string {
  const currentRoute = useCurrentRoute()
  const { q } = useSearch({ strict: false })
  const taskId = currentRoute.kind === 'task-detail' ? currentRoute.taskId : ''
  const { data: task } = useTask(taskId, {
    enabled: currentRoute.kind === 'task-detail',
  })

  switch (currentRoute.kind) {
    case 'project-detail':
      return `project:${currentRoute.projectId}`
    case 'task-list':
      return typeof q === 'string' ? extractSearchScopeTokens(q).join(' ') : ''
    case 'task-detail':
      return task?.projectId == null ? '' : `project:${task.projectId}`
    case 'other':
      return ''
  }
}
