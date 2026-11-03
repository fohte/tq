import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { fn } from 'storybook/test'

import { InboxKanbanPresentation } from '#components/kanban/inbox-kanban-presentation'
import { makePrioritySettings } from '#components/task/priority-settings-test-fixtures'
import { makeTask } from '#components/task/task-row-test-fixtures'
import type { PrioritySetting } from '#hooks/use-priority-settings'
import { prioritySettingsKeys } from '#lib/query-keys'
import { StoryRouter } from '#storybook-config/story-router'

const priorityOrder = [1, null, 2, 0, -1] as const
const prioritySettings = makePrioritySettings().map((setting) => ({
  ...setting,
  sortOrder: priorityOrder.findIndex(
    (priority) => priority === setting.priority,
  ),
})) satisfies PrioritySetting[]

function settingFor(priority: PrioritySetting['priority']): PrioritySetting {
  return (
    prioritySettings.find((setting) => setting.priority === priority) ?? {
      priority,
      name: priority === null ? 'Inbox' : 'Priority',
      description: '',
      sortOrder: prioritySettings.length,
    }
  )
}

function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    client.setQueryData(prioritySettingsKeys.all, makePrioritySettings())
    return client
  })

  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => <>{children}</>}
        paths={['/tasks/$taskId', '/tasks']}
      />
    </QueryClientProvider>
  )
}

function InboxKanbanStory(
  props: React.ComponentProps<typeof InboxKanbanPresentation>,
) {
  return (
    <Providers>
      <div className="h-96 w-full max-w-6xl border border-border">
        <InboxKanbanPresentation {...props} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Kanban/InboxKanbanPresentation',
  component: InboxKanbanStory,
  parameters: {
    layout: 'centered',
    overflowCheck: { ignoreSelectors: ['.overflow-x-auto'] },
  },
  args: {
    onDrop: fn(),
  },
} satisfies Meta<typeof InboxKanbanStory>

export default meta
type Story = StoryObj<typeof meta>

export const ConfiguredPriorities: Story = {
  name: 'the inbox columns follow the configured names and order',
  args: {
    priorityColumns: [
      {
        setting: settingFor(2),
        tasks: [makeTask({ id: 'urgent', priority: 2, title: 'Ship the fix' })],
        isLoading: false,
      },
      {
        setting: settingFor(null),
        tasks: [
          makeTask({ id: 'inbox', priority: null, title: 'Plan the launch' }),
        ],
        isLoading: false,
      },
      {
        setting: settingFor(1),
        tasks: [],
        isLoading: false,
      },
      {
        setting: settingFor(0),
        tasks: [],
        isLoading: false,
      },
      {
        setting: settingFor(-1),
        tasks: [],
        isLoading: false,
      },
    ],
    waitingTasks: [makeTask({ id: 'waiting', title: 'Get an approval' })],
    waitingIsLoading: false,
    waitingHasError: false,
  },
}
