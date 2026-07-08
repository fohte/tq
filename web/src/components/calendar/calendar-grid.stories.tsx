import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  type CalendarDndCallbacks,
  CalendarGrid,
} from '@web/components/calendar/calendar-grid'
import type { CalendarViewType } from '@web/components/calendar/calendar-header'
import type { TimeBlockEvent } from '@web/components/calendar/calendar-view'
import { formatLocalDate } from '@web/lib/date-range'
import { fn } from 'storybook/test'

const today = new Date()
const dateStr = `${String(today.getFullYear())}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
const tomorrow = new Date(today)
tomorrow.setDate(tomorrow.getDate() + 1)
const tomorrowStr = formatLocalDate(tomorrow)

const sampleEvents: TimeBlockEvent[] = [
  {
    id: '1',
    title: 'API ドキュメント作成',
    start: `${dateStr}T09:00:00`,
    end: `${dateStr}T10:00:00`,
    type: 'manual',
    duration: '1h',
    label: 'dev:tq',
  },
  {
    id: '2',
    title: 'テスト追加',
    start: `${dateStr}T10:30:00`,
    end: `${dateStr}T11:30:00`,
    type: 'auto',
    duration: '1h',
    parentRef: '#488 tq 作成',
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
    title: 'Gym',
    start: `${dateStr}T07:00:00`,
    end: `${dateStr}T08:00:00`,
    type: 'schedule',
    color: { bg: '#1B4332', accent: '#52B788' },
    icon: 'dumbbell',
  },
  {
    id: '5',
    title: 'Company holiday',
    start: dateStr,
    end: tomorrowStr,
    type: 'gcal',
    allDay: true,
  },
]

const dndCallbacks: CalendarDndCallbacks = {
  onEventDrop: fn(),
  onEventResize: fn(),
  onExternalDrop: fn(),
}

const meta = {
  title: 'Calendar/CalendarGrid',
  component: CalendarGrid,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    activeView: {
      control: 'select',
      options: ['day', 'week', 'month'] satisfies CalendarViewType[],
    },
  },
  decorators: [
    (Story) => (
      <div style={{ height: '100vh' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    events: sampleEvents,
    dndCallbacks,
    onDateClick: fn(),
  },
} satisfies Meta<typeof CalendarGrid>

export default meta
type Story = StoryObj<typeof meta>

export const DayView: Story = {
  args: {
    activeView: 'day',
  },
}

export const WeekView: Story = {
  args: {
    activeView: 'week',
  },
}

export const MonthView: Story = {
  args: {
    activeView: 'month',
  },
}

export const Empty: Story = {
  args: {
    activeView: 'day',
    events: [],
  },
}
