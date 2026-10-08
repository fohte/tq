import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { StatusLine } from '#components/layout/status-line'
import { makeQueueItem } from '#components/task/queue-item-test-fixtures'
import { resetSessionOpenSettings } from '#hooks/session-open-settings-test-fixtures'
import type { QueueItem } from '#hooks/use-queues'
import { queueKeys } from '#hooks/use-queues'
import { taskKeys } from '#hooks/use-tasks'
import { formatLocalDate } from '#lib/date-range'
import { getSearchKeybinding, type SearchKeybinding } from '#lib/keybindings'
import { StoryRouter } from '#storybook-config/story-router'

const todayStr = formatLocalDate(new Date())

const queueItems: QueueItem[] = [
  makeQueueItem({
    id: 'queue-item-1',
    taskId: 'task-1',
    periodStart: todayStr,
  }),
  makeQueueItem({
    id: 'queue-item-2',
    taskId: 'task-2',
    periodStart: todayStr,
  }),
  makeQueueItem({
    id: 'queue-item-3',
    taskId: 'task-3',
    periodStart: todayStr,
  }),
]

function StatusLineStory({
  searchKeybinding,
}: {
  searchKeybinding: SearchKeybinding
}) {
  // Pin the context used by both count and queue queries to this story.
  resetSessionOpenSettings({ localContext: 'personal' })

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(
    taskKeys.count({ context: 'personal', status: 'todo' }),
    24,
  )
  queryClient.setQueryData(
    queueKeys.items('day', todayStr, 'personal'),
    queueItems,
  )

  return (
    <QueryClientProvider client={queryClient}>
      <StatusLine searchKeybinding={searchKeybinding} />
    </QueryClientProvider>
  )
}

function StatusLineWithRouter({
  currentPath,
  searchKeybinding,
}: {
  currentPath: string
  searchKeybinding: SearchKeybinding
}) {
  return (
    <StoryRouter
      component={() => <StatusLineStory searchKeybinding={searchKeybinding} />}
      initialPath={currentPath}
    />
  )
}

const macSearchKeybinding = getSearchKeybinding('MacIntel')
const nonMacSearchKeybinding = getSearchKeybinding('Linux x86_64')

const meta = {
  title: 'Layout/StatusLine',
  component: StatusLineWithRouter,
  tags: ['desktop-only'],
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    currentPath: {
      control: 'select',
      options: ['/', '/tasks', '/today', '/projects'],
    },
  },
} satisfies Meta<typeof StatusLineWithRouter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'the status line shows the home route and Cmd+K on macOS',
  args: {
    currentPath: '/',
    searchKeybinding: macSearchKeybinding,
  },
}

export const TasksPath: Story = {
  name: 'the status line shows the task route and Cmd+K on macOS',
  args: {
    currentPath: '/tasks',
    searchKeybinding: macSearchKeybinding,
  },
}

export const NonMacOS: Story = {
  name: 'the status line shows Ctrl+K on non-Mac platforms',
  args: {
    currentPath: '/',
    searchKeybinding: nonMacSearchKeybinding,
  },
}
