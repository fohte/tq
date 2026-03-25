import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  CalendarView,
  type TimeBlockEvent,
} from '@web/components/calendar/calendar-view'

const today = new Date()
const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

// Generate events spread across the week for week/month views
function generateWeekEvents(): TimeBlockEvent[] {
  const events: TimeBlockEvent[] = []
  for (let dayOffset = -3; dayOffset <= 3; dayOffset++) {
    const d = new Date(today)
    d.setDate(d.getDate() + dayOffset)
    const ds = d.toISOString().slice(0, 10)
    events.push(
      {
        id: `w-${dayOffset}-1`,
        title: 'Standup',
        start: `${ds}T09:00:00`,
        end: `${ds}T09:30:00`,
        type: 'gcal',
      },
      {
        id: `w-${dayOffset}-2`,
        title: 'Deep work',
        start: `${ds}T10:00:00`,
        end: `${ds}T12:00:00`,
        type: 'manual',
        duration: '2h',
        label: 'dev:tq',
      },
    )
    if (dayOffset % 2 === 0) {
      events.push({
        id: `w-${dayOffset}-3`,
        title: 'Code review',
        start: `${ds}T14:00:00`,
        end: `${ds}T15:00:00`,
        type: 'auto',
        duration: '1h',
      })
    }
  }
  return events
}

// Generate events across a month for month view
function generateMonthEvents(): TimeBlockEvent[] {
  const events: TimeBlockEvent[] = []
  const year = today.getFullYear()
  const month = today.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  for (let day = 1; day <= daysInMonth; day++) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    // Add 1-3 events per day
    events.push({
      id: `m-${day}-1`,
      title: 'Task',
      start: `${ds}T09:00:00`,
      end: `${ds}T10:00:00`,
      type: 'manual',
    })
    if (day % 2 === 0) {
      events.push({
        id: `m-${day}-2`,
        title: 'Meeting',
        start: `${ds}T14:00:00`,
        end: `${ds}T15:00:00`,
        type: 'gcal',
      })
    }
    if (day % 3 === 0) {
      events.push({
        id: `m-${day}-3`,
        title: 'Review',
        start: `${ds}T16:00:00`,
        end: `${ds}T17:00:00`,
        type: 'auto',
      })
    }
  }
  return events
}

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
    title: 'CI パイプライン構築',
    start: `${dateStr}T14:00:00`,
    end: `${dateStr}T15:00:00`,
    type: 'completed',
    duration: '1h',
  },
  {
    id: '5',
    title: 'Gym',
    start: `${dateStr}T07:00:00`,
    end: `${dateStr}T08:00:00`,
    type: 'schedule',
    color: { bg: '#1B4332', accent: '#52B788' },
    icon: 'dumbbell',
  },
  {
    id: '6',
    title: 'Lunch',
    start: `${dateStr}T12:00:00`,
    end: `${dateStr}T13:00:00`,
    type: 'gcal',
  },
  {
    id: '9',
    title: 'Quick sync',
    start: `${dateStr}T15:00:00`,
    end: `${dateStr}T15:15:00`,
    type: 'gcal',
  },
  {
    id: '10',
    title: 'PR レビュー',
    start: `${dateStr}T16:00:00`,
    end: `${dateStr}T16:30:00`,
    type: 'manual',
    duration: '30m',
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

export const WeekView: Story = {
  args: {
    events: generateWeekEvents(),
    initialView: 'week',
  },
}

export const MonthView: Story = {
  args: {
    events: generateMonthEvents(),
    initialView: 'month',
  },
}

export const WeekViewWithDayEvents: Story = {
  args: {
    events: [...sampleEvents, ...generateWeekEvents()],
    initialView: 'week',
  },
}

export const MonthViewEmpty: Story = {
  args: {
    events: [],
    initialView: 'month',
  },
}

const tomorrow = new Date(today)
tomorrow.setDate(tomorrow.getDate() + 1)
const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

export const OvernightEvents: Story = {
  args: {
    events: [
      ...sampleEvents,
      {
        id: '7',
        title: 'Overnight deploy',
        start: `${dateStr}T23:00:00`,
        end: `${tomorrowStr}T01:00:00`,
        type: 'manual',
        duration: '2h',
      },
      {
        id: '8',
        title: 'Sleep',
        start: `${dateStr}T23:30:00`,
        end: `${tomorrowStr}T07:00:00`,
        type: 'schedule',
        color: { bg: '#2D2B55', accent: '#6C63FF' },
        icon: 'moon',
      },
    ],
  },
}
