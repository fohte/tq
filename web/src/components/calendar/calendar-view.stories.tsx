import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  CalendarView,
  type TimeBlockEvent,
} from '@web/components/calendar/calendar-view'

const today = new Date()
const dateStr = today.toISOString().slice(0, 10)

const sampleEvents: TimeBlockEvent[] = [
  {
    id: '1',
    title: 'Design review',
    start: `${dateStr}T09:00:00`,
    end: `${dateStr}T10:00:00`,
    type: 'manual',
  },
  {
    id: '2',
    title: 'Write API docs',
    start: `${dateStr}T10:30:00`,
    end: `${dateStr}T11:30:00`,
    type: 'auto',
  },
  {
    id: '3',
    title: 'Team standup',
    start: `${dateStr}T11:00:00`,
    end: `${dateStr}T11:30:00`,
    type: 'gcal',
  },
  {
    id: '4',
    title: 'Set up CI pipeline',
    start: `${dateStr}T14:00:00`,
    end: `${dateStr}T15:00:00`,
    type: 'completed',
  },
  {
    id: '5',
    title: 'Daily review',
    start: `${dateStr}T17:00:00`,
    end: `${dateStr}T17:30:00`,
    type: 'schedule',
  },
]

const meta = {
  title: 'Calendar/CalendarView',
  component: CalendarView,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div style={{ height: '100vh' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CalendarView>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: {},
}

export const WithEvents: Story = {
  args: {
    events: sampleEvents,
  },
}

export const ManualOnly: Story = {
  args: {
    events: sampleEvents.filter((e) => e.type === 'manual'),
  },
}

const tomorrow = new Date(today)
tomorrow.setDate(tomorrow.getDate() + 1)
const tomorrowStr = tomorrow.toISOString().slice(0, 10)

export const OvernightEvents: Story = {
  args: {
    events: [
      ...sampleEvents,
      {
        id: '6',
        title: 'Overnight deploy',
        start: `${dateStr}T23:00:00`,
        end: `${tomorrowStr}T01:00:00`,
        type: 'manual',
      },
      {
        id: '7',
        title: 'Sleep schedule',
        start: `${dateStr}T23:30:00`,
        end: `${tomorrowStr}T07:00:00`,
        type: 'schedule',
      },
    ],
  },
}
