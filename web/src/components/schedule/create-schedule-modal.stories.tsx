import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fn } from 'storybook/test'

import { CreateScheduleModal } from '#components/schedule/create-schedule-modal'
import { makeSchedule } from '#components/schedule/schedule-test-fixtures'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const meta = {
  title: 'Schedule/CreateScheduleModal',
  component: CreateScheduleModal,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="dark h-screen bg-background">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  args: {
    open: true,
    onOpenChange: fn(),
    defaultStartDate: '2026-01-01',
  },
} satisfies Meta<typeof CreateScheduleModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'the form includes a start date for a single schedule',
}

export const Edit: Story = {
  name: 'the form shows the start date and details of an existing schedule',
  args: {
    schedule: makeSchedule(),
  },
}
