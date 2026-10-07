import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { SidebarTimeBlocks } from '#components/task/sidebar-time-blocks'
import { makeTimeBlock } from '#components/task/time-block-test-fixtures'

const taskId = '00000000-0000-0000-0000-000000000001'

const manualBlock = makeTimeBlock({
  id: 'block-manual',
  taskId,
  startTime: '2026-07-29T16:00:00.000Z',
  endTime: '2026-07-29T16:45:00.000Z',
  isAutoScheduled: false,
})

const autoBlock = makeTimeBlock({
  id: 'block-auto',
  taskId,
  startTime: '2026-07-30T10:00:00.000Z',
  endTime: '2026-07-30T11:30:00.000Z',
  isAutoScheduled: true,
})

const meta = {
  title: 'Task/TaskDetail/SidebarTimeBlocks',
  component: SidebarTimeBlocks,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <div className="max-w-sm border border-border">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof SidebarTimeBlocks>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  name: 'the section has no scheduled time blocks for the task',
  args: {
    taskId,
    timeBlocks: [],
  },
}

export const WithManualAndAutoBlocks: Story = {
  name: 'the section shows manual and automatically scheduled blocks together',
  args: {
    taskId,
    timeBlocks: [autoBlock, manualBlock],
  },
}
