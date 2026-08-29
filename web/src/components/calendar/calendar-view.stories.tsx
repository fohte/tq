import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import {
  CalendarView,
  type TimeBlockEvent,
} from '#components/calendar/calendar-view'

const today = new Date()
const dateStr = `${String(today.getFullYear())}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

// Generate events spread across the week for week/month views
function generateWeekEvents(): TimeBlockEvent[] {
  const events: TimeBlockEvent[] = []
  for (let dayOffset = -3; dayOffset <= 3; dayOffset++) {
    const d = new Date(today)
    d.setDate(d.getDate() + dayOffset)
    const ds = d.toISOString().slice(0, 10)
    const nextD = new Date(d)
    nextD.setDate(nextD.getDate() + 1)
    const nextDs = nextD.toISOString().slice(0, 10)

    // Daily recurring schedules
    events.push(
      {
        id: `w-${String(dayOffset)}-sleep-pm`,
        title: 'Sleep',
        start: `${ds}T23:00:00`,
        end: `${nextDs}T00:00:00`,
        type: 'schedule',
        color: { accent: '#6C63FF' },
      },
      {
        id: `w-${String(dayOffset)}-sleep-am`,
        title: 'Sleep',
        start: `${ds}T00:00:00`,
        end: `${ds}T07:00:00`,
        type: 'schedule',
        color: { accent: '#6C63FF' },
      },
    )

    events.push(
      {
        id: `w-${String(dayOffset)}-1`,
        title: 'Standup',
        start: `${ds}T09:00:00`,
        end: `${ds}T09:30:00`,
        type: 'gcal',
      },
      {
        id: `w-${String(dayOffset)}-2`,
        title: 'Deep work',
        start: `${ds}T10:00:00`,
        end: `${ds}T12:00:00`,
        type: 'manual',
      },
    )
    if (dayOffset % 2 === 0) {
      events.push({
        id: `w-${String(dayOffset)}-3`,
        title: 'Code review',
        start: `${ds}T14:00:00`,
        end: `${ds}T15:00:00`,
        type: 'auto',
      })
    }
    // Gym schedule on weekdays only (Mon-Fri)
    if (d.getDay() >= 1 && d.getDay() <= 5) {
      events.push({
        id: `w-${String(dayOffset)}-gym`,
        title: 'Gym',
        start: `${ds}T18:00:00`,
        end: `${ds}T19:00:00`,
        type: 'schedule',
        color: { accent: '#52B788' },
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
    const ds = `${String(year)}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    // Add 1-3 events per day
    events.push({
      id: `m-${String(day)}-1`,
      title: 'Task',
      start: `${ds}T09:00:00`,
      end: `${ds}T10:00:00`,
      type: 'manual',
    })
    if (day % 2 === 0) {
      events.push({
        id: `m-${String(day)}-2`,
        title: 'Meeting',
        start: `${ds}T14:00:00`,
        end: `${ds}T15:00:00`,
        type: 'gcal',
      })
    }
    if (day % 3 === 0) {
      events.push({
        id: `m-${String(day)}-3`,
        title: 'Review',
        start: `${ds}T16:00:00`,
        end: `${ds}T17:00:00`,
        type: 'auto',
      })
    }
  }
  return events
}

const tomorrow = new Date(today)
tomorrow.setDate(tomorrow.getDate() + 1)
const tomorrowStr = `${String(tomorrow.getFullYear())}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

const sampleEvents: TimeBlockEvent[] = [
  {
    id: '1',
    title: 'API ドキュメント作成',
    start: `${dateStr}T09:00:00`,
    end: `${dateStr}T10:00:00`,
    type: 'manual',
  },
  {
    id: '2',
    title: 'テスト追加',
    start: `${dateStr}T10:30:00`,
    end: `${dateStr}T11:30:00`,
    type: 'auto',
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
  },
  {
    id: '5',
    title: 'Gym',
    start: `${dateStr}T07:00:00`,
    end: `${dateStr}T08:00:00`,
    type: 'schedule',
    color: { accent: '#52B788' },
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
  },
  {
    id: '11',
    title: 'Company holiday',
    start: dateStr,
    end: tomorrowStr,
    type: 'gcal',
    allDay: true,
  },
]

const meta = {
  title: 'Calendar/CalendarView',
  component: CalendarView,
  parameters: {
    layout: 'fullscreen',
    // FullCalendar's internal `.fc-scroller` reports scrollWidth >
    // clientWidth by a fixed ~80px whenever its vertical scrollbar is
    // forced on — a library-internal sizing artifact, not fixable here.
    overflowCheck: { ignoreSelectors: ['.fc-scroller'] },
  },
  decorators: [
    (Story) => (
      <div style={{ height: '100vh' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    selectedDate: today,
    onDateChange: fn(),
  },
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

export const SchedulesOnly: Story = {
  args: {
    events: [
      {
        id: 'sched-sleep-am',
        title: 'Sleep',
        start: `${dateStr}T00:00:00`,
        end: `${dateStr}T07:00:00`,
        type: 'schedule',
        color: { accent: '#6C63FF' },
      },
      {
        id: 'sched-gym',
        title: 'Gym',
        start: `${dateStr}T07:00:00`,
        end: `${dateStr}T08:00:00`,
        type: 'schedule',
        color: { accent: '#52B788' },
      },
      {
        id: 'sched-lunch',
        title: 'Lunch',
        start: `${dateStr}T12:00:00`,
        end: `${dateStr}T13:00:00`,
        type: 'schedule',
        color: { accent: '#FF8400' },
      },
      {
        id: 'sched-sleep-pm',
        title: 'Sleep',
        start: `${dateStr}T23:00:00`,
        end: `${tomorrowStr}T00:00:00`,
        type: 'schedule',
        color: { accent: '#6C63FF' },
      },
    ],
  },
}

export const MonthViewEmpty: Story = {
  args: {
    events: [],
    initialView: 'month',
  },
}

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
      },
      {
        id: '8',
        title: 'Sleep',
        start: `${dateStr}T23:30:00`,
        end: `${tomorrowStr}T07:00:00`,
        type: 'schedule',
        color: { accent: '#6C63FF' },
      },
    ],
  },
  play: async ({ canvas }) => {
    // The initial scroll position (CalendarGrid's scrollTime="08:00:00")
    // sits above the 23:00 events this story exists to cover, so the
    // screenshot needs an explicit scroll to bring them into view.
    const overnightEvent = await canvas.findByText('Overnight deploy')
    overnightEvent.scrollIntoView({ block: 'center' })
  },
}
