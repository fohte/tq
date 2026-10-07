import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import {
  CalendarView,
  type TimeBlockEvent,
} from '#components/calendar/calendar-view'
import { makeTimeBlockEvent } from '#components/calendar/time-block-event-test-fixtures'
import { formatLocalDate } from '#lib/date-range'

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
        type: 'gcal-meeting',
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
        type: 'gcal-meeting',
        calendarColor: '#8E24AA',
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
    if (day % 5 === 0) {
      events.push(
        makeTimeBlockEvent({
          id: `m-${String(day)}-4`,
          title: 'Gym',
          start: `${ds}T18:00:00`,
          end: `${ds}T19:00:00`,
          type: 'schedule',
          color: { accent: '#52B788' },
        }),
      )
    }
    if (day % 7 === 0) {
      events.push(
        makeTimeBlockEvent({
          id: `m-${String(day)}-5`,
          title: 'Dentist',
          start: `${ds}T11:00:00`,
          end: `${ds}T12:00:00`,
          type: 'gcal-solo',
          calendarColor: '#039BE5',
        }),
      )
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
    type: 'gcal-meeting',
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
    type: 'gcal-meeting',
  },
  {
    id: '9',
    title: 'Quick sync',
    start: `${dateStr}T15:00:00`,
    end: `${dateStr}T15:15:00`,
    type: 'gcal-meeting',
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
    type: 'gcal-info',
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
      <div className="h-screen">
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
  name: 'the calendar shows an empty daily timeline',
  args: {},
}

export const WithEvents: Story = {
  name: 'the daily calendar places tasks, meetings, and schedules on the timeline',
  args: {
    events: sampleEvents,
  },
}

export const CompactDay: Story = {
  name: 'the compact calendar keeps a daily timeline without a view switcher',
  tags: ['mobile-only'],
  decorators: [
    (Story) => (
      <div className="mx-auto h-screen w-80 max-w-full">
        <Story />
      </div>
    ),
  ],
  args: {
    events: sampleEvents,
    showViewSwitcher: false,
  },
}

export const ManualOnly: Story = {
  name: 'the daily calendar shows manually scheduled tasks without other events',
  args: {
    events: sampleEvents.filter((e) => e.type === 'manual'),
  },
}

export const WeekView: Story = {
  name: 'the weekly calendar arranges timed events across seven days',
  args: {
    events: generateWeekEvents(),
    initialView: 'week',
  },
}

export const MonthView: Story = {
  name: 'the monthly calendar places events in their date cells',
  args: {
    events: generateMonthEvents(),
    initialView: 'month',
  },
}

export const MonthViewEventStyles: Story = {
  name: 'the monthly calendar distinguishes private events and queued tasks',
  args: {
    initialView: 'month',
    events: [
      makeTimeBlockEvent({
        id: 'sample-private-event',
        title: 'Private sample appointment',
        start: `${String(today.getFullYear())}-${String(today.getMonth() + 1).padStart(2, '0')}-02T09:00:00`,
        end: `${String(today.getFullYear())}-${String(today.getMonth() + 1).padStart(2, '0')}-02T09:30:00`,
        type: 'gcal-meeting',
        calendarColor: '#039BE5',
        redacted: true,
      }),
      makeTimeBlockEvent({
        id: 'sample-queued-task',
        title: 'Queued sample task',
        start: formatLocalDate(
          new Date(today.getFullYear(), today.getMonth(), 3),
        ),
        end: formatLocalDate(
          new Date(today.getFullYear(), today.getMonth(), 4),
        ),
        type: 'day-queue',
        taskId: 'sample-queued-task',
        queuePosition: 0,
        allDay: true,
      }),
    ],
  },
}

export const MonthViewWithTaskDates: Story = {
  name: 'the monthly calendar shows task dates in date cells',
  args: {
    initialView: 'month',
    events: [
      makeTimeBlockEvent({
        id: 'sample-launch-due',
        title: 'Plan a sample launch',
        start: formatLocalDate(
          new Date(today.getFullYear(), today.getMonth(), 24),
        ),
        end: formatLocalDate(
          new Date(today.getFullYear(), today.getMonth(), 25),
        ),
        type: 'task-date',
        taskId: 'sample-launch',
        allDay: true,
        dateTaskKind: 'due',
      }),
      makeTimeBlockEvent({
        id: 'sample-date-due',
        title: 'Send a sample draft',
        start: formatLocalDate(
          new Date(today.getFullYear(), today.getMonth(), 10),
        ),
        end: formatLocalDate(
          new Date(today.getFullYear(), today.getMonth(), 11),
        ),
        type: 'task-date',
        taskId: 'sample-date-due',
        allDay: true,
        dateTaskKind: 'due',
      }),
      makeTimeBlockEvent({
        id: 'sample-date-start',
        title: 'Begin a sample review',
        start: formatLocalDate(
          new Date(today.getFullYear(), today.getMonth(), 16),
        ),
        end: formatLocalDate(
          new Date(today.getFullYear(), today.getMonth(), 17),
        ),
        type: 'task-date',
        taskId: 'sample-date-start',
        allDay: true,
        dateTaskKind: 'start',
      }),
    ],
  },
}

export const OverdueReminderPriority: Story = {
  name: 'the overdue reminder appears before other all-day events',
  args: {
    events: [
      {
        id: 'sample-calendar-event',
        title: 'A sample calendar event',
        start: dateStr,
        end: tomorrowStr,
        type: 'gcal-info',
        allDay: true,
      },
      makeTimeBlockEvent({
        id: 'sample-overdue-reminder',
        title: 'Review a sample note',
        start: dateStr,
        end: tomorrowStr,
        type: 'task-date',
        taskId: 'sample-overdue-task',
        allDay: true,
        dateTaskKind: 'overdue-today',
        dateTaskOverdue: true,
        dateTaskDueDateLabel: 'Oct 5',
        displayPriority: 1,
      }),
    ],
  },
}

export const WeekViewWithDayEvents: Story = {
  name: 'the weekly calendar combines timed events with all-day items',
  args: {
    events: [...sampleEvents, ...generateWeekEvents()],
    initialView: 'week',
  },
}

export const SchedulesOnly: Story = {
  name: 'the calendar displays recurring schedule blocks without other events',
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
  name: 'the monthly calendar keeps its date cells visible without events',
  args: {
    events: [],
    initialView: 'month',
  },
}

export const OvernightEvents: Story = {
  name: 'the daily timeline shows an event that continues past midnight',
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
    // The computed default scroll position sits above the 23:00 events this
    // story exists to cover — pin it so they're in view without a play.
    initialScrollTime: '21:00:00',
  },
}
