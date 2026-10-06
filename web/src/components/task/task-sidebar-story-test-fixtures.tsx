import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { makeQueueItem } from '#components/task/queue-item-test-fixtures'
import type { ProjectDetail } from '#hooks/use-projects'
import { projectKeys } from '#hooks/use-projects'
import { DAY_QUEUE_KEY, queueKeys, WEEK_QUEUE_KEY } from '#hooks/use-queues'
import type { TaskDetail } from '#hooks/use-tasks'
import { taskKeys } from '#hooks/use-tasks'
import { formatLocalDate } from '#lib/date-range'
import { labelKeys } from '#lib/query-keys'
import { StoryRouter } from '#storybook-config/story-router'

export function TaskSidebarStoryProviders({
  children,
  task,
  project,
}: {
  children: ReactNode
  task: TaskDetail
  project?: ProjectDetail | undefined
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(taskKeys.list(undefined), [])
  queryClient.setQueryData(labelKeys.list({ context: 'personal' }), [])
  queryClient.setQueryData(
    projectKeys.list(undefined),
    project ? [project] : [],
  )
  const todayStr = formatLocalDate(new Date())
  queryClient.setQueryData(queueKeys.items(DAY_QUEUE_KEY, todayStr), [])
  queryClient.setQueryData(queueKeys.items(WEEK_QUEUE_KEY, todayStr), [])
  if (project) {
    queryClient.setQueryData(projectKeys.detail(project.id), project)
  }
  // Auto-scheduled block rows fetch their day's queue before deletion.
  for (const block of task.timeBlocks) {
    if (!block.isAutoScheduled) continue
    const date = formatLocalDate(new Date(block.startTime))
    queryClient.setQueryData(queueKeys.items(DAY_QUEUE_KEY, date), [
      makeQueueItem({
        id: `queue-item-${block.id}`,
        taskId: task.id,
        periodStart: date,
        createdAt: block.createdAt,
        updatedAt: block.updatedAt,
      }),
    ])
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => <>{children}</>}
        paths={['/tasks', '/tasks/$taskId', '/projects/$projectId']}
      />
    </QueryClientProvider>
  )
}
