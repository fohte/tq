import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { makePrioritySettings } from '#components/task/priority-settings-test-fixtures'
import { SidebarPriorityField } from '#components/task/sidebar-priority-field'
import { prioritySettingsKeys } from '#lib/query-keys'

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(prioritySettingsKeys.all, makePrioritySettings())
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function SidebarPriorityFieldStory() {
  return (
    <Providers>
      <div className="w-60 border-l border-border p-4">
        <SidebarPriorityField taskId="task-example" priority={0} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/TaskDetail/SidebarPriorityField',
  component: SidebarPriorityFieldStory,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof SidebarPriorityFieldStory>

export default meta
type Story = StoryObj<typeof meta>

export const SelectedPriority: Story = {
  name: 'the sidebar field shows the configured priority name',
}
