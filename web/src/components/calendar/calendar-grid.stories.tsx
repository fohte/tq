import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'

import {
  type CalendarDndCallbacks,
  CalendarGrid,
} from '#components/calendar/calendar-grid'
import type { CalendarViewType } from '#components/calendar/calendar-header'
import type { TimeBlockEvent } from '#components/calendar/calendar-view'
import { formatLocalDate } from '#lib/date-range'
import { assertDefined } from '#lib/test-utils'

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
    taskId: 'task-1',
  },
  {
    id: '2',
    title: 'テスト追加',
    start: `${dateStr}T10:30:00`,
    end: `${dateStr}T11:30:00`,
    type: 'auto',
    parentRef: '#488 tq 作成',
    taskId: 'task-2',
  },
  {
    id: '3',
    title: 'Team standup',
    start: `${dateStr}T11:00:00`,
    end: `${dateStr}T11:30:00`,
    type: 'gcal-meeting',
  },
  {
    id: '4',
    title: 'Gym',
    start: `${dateStr}T07:00:00`,
    end: `${dateStr}T08:00:00`,
    type: 'schedule',
    color: { accent: '#52B788' },
    scheduleId: 'sched-gym',
  },
  {
    id: '5',
    title: 'Company holiday',
    start: dateStr,
    end: tomorrowStr,
    type: 'gcal-info',
    allDay: true,
  },
  {
    id: '6',
    title: 'Design review',
    start: `${dateStr}T13:00:00`,
    end: `${dateStr}T13:30:00`,
    type: 'gcal-meeting',
    responseStatus: 'tentative',
  },
  {
    id: '7',
    title: '集中作業',
    start: `${dateStr}T12:00:00`,
    end: `${dateStr}T14:00:00`,
    type: 'gcal-status',
    gcalEventType: 'focusTime',
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
    // FullCalendar's internal `.fc-scroller` reports scrollWidth >
    // clientWidth by a fixed ~80px whenever its vertical scrollbar is
    // forced on — a library-internal sizing artifact, not fixable here.
    overflowCheck: { ignoreSelectors: ['.fc-scroller'] },
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
    onScheduleClick: fn(),
    onTaskClick: fn(),
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

export const ClickTaskEvent: Story = {
  args: {
    activeView: 'day',
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(await canvas.findByText('API ドキュメント作成'))
    await expect(args.onTaskClick).toHaveBeenCalledWith('task-1')
  },
}

export const ClickGcalEvent: Story = {
  args: {
    activeView: 'day',
  },
  play: async ({ canvas, userEvent, args }) => {
    const manualEvent = assertDefined(
      (await canvas.findByText('API ドキュメント作成')).closest('.fc-event'),
      'manual event .fc-event ancestor not found',
    )
    const gcalEvent = assertDefined(
      canvas.getByText('Team standup').closest('.fc-event'),
      'gcal event .fc-event ancestor not found',
    )

    await userEvent.click(canvas.getByText('Team standup'))

    await expect(args.onTaskClick).not.toHaveBeenCalled()
    await expect(args.onScheduleClick).not.toHaveBeenCalled()
    await expect(getComputedStyle(gcalEvent).cursor).toBe('default')
    await expect(getComputedStyle(manualEvent).cursor).toBe('pointer')
  },
}
