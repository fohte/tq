import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { TaskSidebarMobile } from '#components/task/task-detail-sidebar'
import { makeTaskDetail } from '#components/task/task-row-test-fixtures'
import { projectKeys } from '#hooks/use-projects'
import { DAY_QUEUE_KEY, queueKeys, WEEK_QUEUE_KEY } from '#hooks/use-queues'
import type { TaskDetail } from '#hooks/use-tasks'
import { formatLocalDate } from '#lib/date-range'
import { labelKeys, taskKeys } from '#lib/query-keys'
import { StoryRouter } from '#storybook-config/story-router'

function MobileSidebarStory({ task }: { task: TaskDetail }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(taskKeys.list(undefined), [])
  queryClient.setQueryData(labelKeys.list({ context: 'personal' }), [])
  queryClient.setQueryData(projectKeys.list(undefined), [])
  const todayStr = formatLocalDate(new Date())
  queryClient.setQueryData(queueKeys.items(DAY_QUEUE_KEY, todayStr), [])
  queryClient.setQueryData(queueKeys.items(WEEK_QUEUE_KEY, todayStr), [])

  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => (
          <div className="max-w-sm border-t border-border p-4">
            <TaskSidebarMobile task={task} />
          </div>
        )}
        paths={['/tasks', '/tasks/$taskId', '/projects/$projectId']}
      />
    </QueryClientProvider>
  )
}

const meta = {
  title: 'Task/TaskDetail/Sidebar',
  component: MobileSidebarStory,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof MobileSidebarStory>

export default meta
type Story = StoryObj<typeof meta>

export const MobileSidebar: Story = {
  name: 'task details appear in the compact mobile sidebar',
  args: {
    task: makeTaskDetail(),
  },
}

export const MobileSidebarWithChecklistProgress: Story = {
  name: 'the mobile sidebar shows checklist progress',
  args: {
    task: makeTaskDetail({
      checklistCompletionCount: { completed: 1, total: 4 },
    }),
  },
}
