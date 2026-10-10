import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { ScheduleModalMobilePanel } from '#components/schedule/create-schedule-modal-mobile-panel'

const meta = {
  title: 'Schedule/CreateScheduleModalMobilePanel',
  component: ScheduleModalMobilePanel,
  parameters: {
    layout: 'fullscreen',
    overflowCheck: { ignoreSelectors: ['.overflow-x-auto'] },
  },
  tags: ['mobile-only'],
  decorators: [
    (Story) => (
      <div className="dark min-h-screen bg-background">
        <div className="fixed inset-0 bg-black/40" />
        <Story />
      </div>
    ),
  ],
  args: {
    schedule: undefined,
    handleOpenChange: fn(),
    title: 'Sample schedule',
    setTitle: fn(),
    startDate: '2030-04-17',
    setStartDate: fn(),
    startTime: '08:30',
    setStartTime: fn(),
    endTime: '09:00',
    setEndTime: fn(),
    recurrenceType: '',
    setRecurrenceType: fn(),
    daysOfWeek: [],
    toggleDay: fn(),
    dayOfMonth: '',
    setDayOfMonth: fn(),
    context: '',
    setContext: fn(),
    color: '',
    setColor: fn(),
    onDelete: fn(),
    isPending: false,
    canSubmit: true,
    handleSubmit: fn(),
  },
} satisfies Meta<typeof ScheduleModalMobilePanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'the mobile panel shows the selected start date',
}
