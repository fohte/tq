import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, fireEvent, fn, waitFor } from 'storybook/test'

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
    isAutoScheduled: true,
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

// Resolves the topmost element via hit-testing before dispatching mouseMove.
function hoverPoint(x: number, y: number) {
  const target = assertDefined(
    document.elementFromPoint(x, y),
    `no element found at (${String(x)}, ${String(y)})`,
  )
  return fireEvent.mouseMove(target, { clientX: x, clientY: y })
}

// FullCalendar renders more than one `.fc-scroller` (header/body/etc.);
// only the vertically-scrollable one is the time grid body.
function findVerticalScroller(canvasElement: HTMLElement): HTMLElement {
  return assertDefined(
    Array.from(
      canvasElement.querySelectorAll<HTMLElement>('.fc-scroller'),
    ).find((el) => el.scrollHeight > el.clientHeight),
    'no vertically scrollable .fc-scroller found',
  )
}

// Reset auto-scroll so Gym stays in view.
function resetVerticalScroll(canvasElement: HTMLElement) {
  findVerticalScroller(canvasElement).scrollTop = 0
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
  // AutoTimeBlockPreview's hover-card wiring calls a query hook on mount
  // regardless of whether it's ever hovered, so a QueryClientProvider is
  // required even though the query itself only fires once opened.
  decorators: [
    (Story) => (
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <div style={{ height: '100vh' }}>
          <Story />
        </div>
      </QueryClientProvider>
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

export const ScrollsToCurrentTime: Story = {
  args: {
    activeView: 'day',
  },
  parameters: {
    // Verifies scroll position only; visually identical to DayView.
    screenshot: { skip: true },
  },
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByText('API ドキュメント作成')
    const scroller = findVerticalScroller(canvasElement)
    const now = new Date()
    const expectedMinutes = Math.max(
      0,
      now.getHours() * 60 + now.getMinutes() - 60,
    )
    // fullcalendar.css sets each 30-minute slot to 26px.
    const expectedPx = expectedMinutes * (26 / 30)

    await expect(scroller.scrollTop).toBeGreaterThan(expectedPx - 15)
    await expect(scroller.scrollTop).toBeLessThan(expectedPx + 15)
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
  parameters: {
    // onTaskClick is a bare mock, so clicking the event never changes the
    // rendered DOM — the screenshot is identical to DayView.
    screenshot: { skip: true },
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(await canvas.findByText('API ドキュメント作成'))
    await expect(args.onTaskClick).toHaveBeenCalledWith('task-1')
  },
}

export const HoverEmptySlot: Story = {
  args: {
    activeView: 'day',
  },
  play: async ({ canvas, canvasElement }) => {
    resetVerticalScroll(canvasElement)
    const gymEvent = assertDefined(
      (await canvas.findByText('Gym')).closest<HTMLElement>('.fc-event'),
      'Gym event .fc-event ancestor not found',
    )
    const gymRect = gymEvent.getBoundingClientRect()
    const hoverX = gymRect.left + gymRect.width / 2
    // Gym ends at 08:00, and the next event starts at 09:00.
    const hoverY = gymRect.bottom + 10

    await hoverPoint(hoverX, hoverY)

    const ghost = await waitFor(() =>
      assertDefined(
        canvasElement.querySelector<HTMLElement>('.tq-slot-hover-ghost'),
        'hover ghost not rendered',
      ),
    )
    const ghostRect = ghost.getBoundingClientRect()
    const slotHeight = assertDefined(
      canvasElement.querySelector('.fc-timegrid-slot')?.getBoundingClientRect()
        .height,
      'slot element not found',
    )
    await expect(ghostRect.height).toBe(slotHeight)
    await expect(ghostRect.top).toBeLessThanOrEqual(hoverY)
    await expect(ghostRect.bottom).toBeGreaterThan(hoverY)
  },
}

export const HoverExistingEvent: Story = {
  args: {
    activeView: 'day',
  },
  parameters: {
    // No ghost renders over an existing event, so the DOM never changes —
    // the screenshot would be identical to DayView.
    screenshot: { skip: true },
  },
  play: async ({ canvas, canvasElement }) => {
    resetVerticalScroll(canvasElement)
    const gymEvent = assertDefined(
      (await canvas.findByText('Gym')).closest<HTMLElement>('.fc-event'),
      'Gym event .fc-event ancestor not found',
    )
    const gymRect = gymEvent.getBoundingClientRect()

    await hoverPoint(
      gymRect.left + gymRect.width / 2,
      gymRect.top + gymRect.height / 2,
    )

    await waitFor(() =>
      expect(canvasElement.querySelector('.tq-slot-hover-ghost')).toBeNull(),
    )
  },
}

export const HoverAxisColumn: Story = {
  args: {
    activeView: 'day',
  },
  parameters: {
    // The time-label gutter never renders a ghost, so the DOM never
    // changes — the screenshot would be identical to DayView.
    screenshot: { skip: true },
  },
  play: async ({ canvasElement }) => {
    const axisCol = assertDefined(
      canvasElement.querySelector<HTMLElement>('.fc-timegrid-axis'),
      'time-axis column not found',
    )
    const rect = axisCol.getBoundingClientRect()

    await hoverPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)

    await waitFor(() =>
      expect(canvasElement.querySelector('.tq-slot-hover-ghost')).toBeNull(),
    )
  },
}

export const HoverAllDayRow: Story = {
  args: {
    activeView: 'day',
  },
  parameters: {
    // No ghost renders over the all-day row, so the DOM never changes —
    // the screenshot would be identical to DayView.
    screenshot: { skip: true },
  },
  play: async ({ canvasElement }) => {
    // The all-day row has no time-slot concept to preview, unlike the
    // timed grid below it — FullCalendar renders it as a dayGrid cell
    // (`.fc-daygrid-day-frame`), not a `.fc-timegrid-col`.
    const allDayCell = assertDefined(
      canvasElement.querySelector<HTMLElement>('.fc-daygrid-day-frame'),
      'all-day row cell not found',
    )
    const rect = allDayCell.getBoundingClientRect()

    await hoverPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)

    await waitFor(() =>
      expect(canvasElement.querySelector('.tq-slot-hover-ghost')).toBeNull(),
    )
  },
}

export const HoverEmptySlotWeekView: Story = {
  args: {
    activeView: 'week',
  },
  parameters: {
    // vrt-capture's duplicate-screenshot check found this byte-identical
    // to WeekView's, even though the play function below confirms the
    // ghost renders at the right position — skip per
    // storybook-vrt-workflows' triage rule (only one of the pair has a
    // play function).
    screenshot: { skip: true },
  },
  play: async ({ canvasElement }) => {
    // All sample events fall on today (see `dateStr` above), so every other
    // day's column is fully empty — pick one that isn't today's.
    const columns = Array.from(
      canvasElement.querySelectorAll<HTMLElement>(
        '.fc-timegrid-col:not(.fc-timegrid-axis)',
      ),
    )
    const otherDayCol = assertDefined(
      columns.find((col) => !col.classList.contains('fc-day-today')),
      'a non-today day column not found',
    )
    const colRect = otherDayCol.getBoundingClientRect()
    // The column's own box spans the full day, most of which is scrolled
    // out of view — hover a point actually inside the visible scroller.
    const hoverY =
      findVerticalScroller(canvasElement).getBoundingClientRect().top + 50

    await hoverPoint(colRect.left + colRect.width / 2, hoverY)

    const ghost = await waitFor(() =>
      assertDefined(
        canvasElement.querySelector<HTMLElement>('.tq-slot-hover-ghost'),
        'hover ghost not rendered',
      ),
    )
    const ghostRect = ghost.getBoundingClientRect()
    await expect(ghostRect.left).toBeCloseTo(colRect.left, 0)
    await expect(ghostRect.width).toBeCloseTo(colRect.width, 0)
  },
}

export const ClickGcalEvent: Story = {
  args: {
    activeView: 'day',
  },
  parameters: {
    // Asserts a gcal event's click is a no-op (no callback, default cursor),
    // so nothing in the rendered DOM changes — the screenshot is identical
    // to DayView.
    screenshot: { skip: true },
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
