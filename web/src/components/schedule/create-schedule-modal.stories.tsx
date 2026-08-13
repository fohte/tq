import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fn } from 'storybook/test'

import { CreateScheduleModal } from '#components/schedule/create-schedule-modal'

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
  },
} satisfies Meta<typeof CreateScheduleModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Edit: Story = {
  args: {
    schedule: {
      scheduleId: 'schedule-1',
      title: 'Gym',
      start: '2026-01-01T07:00:00',
      end: '2026-01-01T08:00:00',
      context: 'personal',
      color: '#6C63FF',
      recurrence: {
        id: 'rule-1',
        type: 'weekly',
        interval: 1,
        daysOfWeek: [1, 3, 5],
        dayOfMonth: null,
      },
    },
  },
}
