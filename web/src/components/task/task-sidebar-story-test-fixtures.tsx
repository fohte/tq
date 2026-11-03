import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { makePrioritySettings } from '#components/task/priority-settings-test-fixtures'
import {
  ALL_PROJECTS_FILTER,
  type ProjectDetail,
  projectKeys,
} from '#hooks/use-projects'
import { DAY_QUEUE_KEY, queueKeys, WEEK_QUEUE_KEY } from '#hooks/use-queues'
import { allTasksFilter, taskKeys } from '#hooks/use-tasks'
import { formatLocalDate } from '#lib/date-range'
import { labelKeys, prioritySettingsKeys } from '#lib/query-keys'
import { StoryRouter } from '#storybook-config/story-router'

export function TaskSidebarStoryProviders({
  children,
  project,
}: {
  children: ReactNode
  project?: ProjectDetail | undefined
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(taskKeys.list(allTasksFilter), [])
  queryClient.setQueryData(labelKeys.list({ context: 'personal' }), [])
  queryClient.setQueryData(prioritySettingsKeys.all, makePrioritySettings())
  queryClient.setQueryData(
    projectKeys.list(ALL_PROJECTS_FILTER),
    project ? [project] : [],
  )
  const todayStr = formatLocalDate(new Date())
  queryClient.setQueryData(queueKeys.items(DAY_QUEUE_KEY, todayStr), [])
  queryClient.setQueryData(queueKeys.items(WEEK_QUEUE_KEY, todayStr), [])
  if (project) {
    queryClient.setQueryData(projectKeys.detail(project.id), project)
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
