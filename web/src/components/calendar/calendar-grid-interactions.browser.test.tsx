import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  type CalendarDndCallbacks,
  CalendarGrid,
} from '#components/calendar/calendar-grid'
import type { TimeBlockEvent } from '#components/calendar/calendar-view'
import { makeTimeBlockEvent } from '#components/calendar/time-block-event-test-fixtures'
import { makeTaskDetail } from '#components/task/task-row-test-fixtures'
import { formatLocalDate } from '#lib/date-range'
import { assertDefined } from '#lib/test-utils'

vi.mock('#lib/api', () => ({
  api: {
    api: {
      tasks: {
        ':id': {
          $get: vi.fn().mockResolvedValue({
            ok: true,
            json: () =>
              Promise.resolve(
                makeTaskDetail({ id: 'task-1', title: 'API ドキュメント作成' }),
              ),
          }),
        },
      },
    },
  },
}))

const today = new Date()
const dateStr = `${String(today.getFullYear())}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
const tomorrow = new Date(today)
tomorrow.setDate(tomorrow.getDate() + 1)
const tomorrowStr = formatLocalDate(tomorrow)

const sampleEvents: TimeBlockEvent[] = [
  makeTimeBlockEvent({
    id: '1',
    title: 'API ドキュメント作成',
    start: `${dateStr}T09:00:00`,
    end: `${dateStr}T10:00:00`,
    type: 'manual',
    taskId: 'task-1',
  }),
  makeTimeBlockEvent({
    id: '3',
    title: 'Team standup',
    start: `${dateStr}T11:00:00`,
    end: `${dateStr}T11:30:00`,
    type: 'gcal-meeting',
  }),
  makeTimeBlockEvent({
    id: '4',
    title: 'Gym',
    start: `${dateStr}T07:00:00`,
    end: `${dateStr}T08:00:00`,
    type: 'schedule',
    color: { accent: '#52B788' },
    scheduleId: 'sched-gym',
  }),
  makeTimeBlockEvent({
    id: '5',
    title: 'Company holiday',
    start: dateStr,
    end: tomorrowStr,
    type: 'gcal-info',
    allDay: true,
  }),
]

const dndCallbacks: CalendarDndCallbacks = {
  onEventDrop: vi.fn(),
  onEventResize: vi.fn(),
  onExternalDrop: vi.fn(),
}

// Resolves the topmost element via hit-testing before dispatching mouseMove.
function hoverPoint(x: number, y: number): Element {
  const target = assertDefined(
    document.elementFromPoint(x, y),
    `no element found at (${String(x)}, ${String(y)})`,
  )
  fireEvent.mouseMove(target, { clientX: x, clientY: y })
  return target
}

// FullCalendar renders more than one `.fc-scroller` (header/body/etc.); only
// the vertically-scrollable one is the time grid body.
function findVerticalScroller(container: HTMLElement): HTMLElement {
  return assertDefined(
    Array.from(container.querySelectorAll<HTMLElement>('.fc-scroller')).find(
      (el) => el.scrollHeight > el.clientHeight,
    ),
    'no vertically scrollable .fc-scroller found',
  )
}

function resetVerticalScroll(container: HTMLElement) {
  findVerticalScroller(container).scrollTop = 0
}

// CalendarGrid needs a QueryClientProvider (the 'manual' event with a taskId
// mounts ManualTimeBlockPreview, which calls useTask on mount unconditionally)
// and a sized wrapper div (FullCalendar needs real layout height).
function renderCalendarGrid(
  props: Partial<React.ComponentProps<typeof CalendarGrid>> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <div style={{ height: '100vh' }}>
        <CalendarGrid
          events={sampleEvents}
          activeView="day"
          dndCallbacks={dndCallbacks}
          onDateClick={vi.fn()}
          onScheduleClick={vi.fn()}
          onTaskClick={vi.fn()}
          {...props}
        />
      </div>
    </QueryClientProvider>,
  )
}

describe('CalendarGrid interactions', () => {
  // The 1280x800 viewport (web/src/browser-test-setup.ts) only leaves ~745px
  // of scrollable height for the 24h time grid (~1248px), so any target past
  // ~10:40 can't be reached and scrollTop clamps to the bottom of the
  // scrollable range — fake the clock so these tests aren't at the mercy of
  // what time CI happens to run.
  describe('mount scroll position', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('scrolls to an hour before the current time on mount', async () => {
      // Only fake `Date` — faking timers wholesale also stubs the
      // `requestAnimationFrame` calls FullCalendar's layout/scroll pipeline
      // relies on, which hangs `findByText` below.
      vi.useFakeTimers({ toFake: ['Date'] })
      const now = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        9,
        0,
        0,
      )
      vi.setSystemTime(now)

      const { container } = renderCalendarGrid()
      await screen.findByText('API ドキュメント作成')
      const scroller = findVerticalScroller(container)
      const expectedMinutes = Math.max(
        0,
        now.getHours() * 60 + now.getMinutes() - 60,
      )
      const expectedPx = expectedMinutes * (26 / 30)
      expect(scroller.scrollTop).toBeGreaterThan(expectedPx - 15)
      expect(scroller.scrollTop).toBeLessThan(expectedPx + 15)
    })

    it('clamps to the bottom of the scrollable range when an hour before the current time is unreachable', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(
        new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          20,
          0,
          0,
        ),
      )

      const { container } = renderCalendarGrid()
      await screen.findByText('API ドキュメント作成')
      const scroller = findVerticalScroller(container)

      expect(scroller.scrollTop).toBeCloseTo(
        scroller.scrollHeight - scroller.clientHeight,
        0,
      )
    })
  })

  it('calls onTaskClick with the task id when a manual event is clicked', async () => {
    const onTaskClick = vi.fn()
    const { container } = renderCalendarGrid({ onTaskClick })
    const user = userEvent.setup()
    await user.click(await within(container).findByText('API ドキュメント作成'))
    expect(onTaskClick).toHaveBeenCalledWith('task-1')
  })

  it('shows a slot ghost with cell cursor when hovering an empty slot', async () => {
    const { container } = renderCalendarGrid()
    resetVerticalScroll(container)
    const gymEvent = assertDefined(
      (await within(container).findByText('Gym')).closest<HTMLElement>(
        '.fc-event',
      ),
      'Gym event .fc-event ancestor not found',
    )
    const gymRect = gymEvent.getBoundingClientRect()
    const hoverX = gymRect.left + gymRect.width / 2
    const hoverY = gymRect.bottom + 10
    const hoveredEl = hoverPoint(hoverX, hoverY)
    const ghost = await waitFor(() =>
      assertDefined(
        container.querySelector<HTMLElement>('.tq-slot-hover-ghost'),
        'hover ghost not rendered',
      ),
    )
    const ghostRect = ghost.getBoundingClientRect()
    const slotHeight = assertDefined(
      container.querySelector('.fc-timegrid-slot')?.getBoundingClientRect()
        .height,
      'slot element not found',
    )
    expect(ghostRect.height).toBe(slotHeight)
    expect(ghostRect.top).toBeLessThanOrEqual(hoverY)
    expect(ghostRect.bottom).toBeGreaterThan(hoverY)
    expect(getComputedStyle(hoveredEl).cursor).toBe('cell')
  })

  it('does not show a slot ghost when hovering an existing event', async () => {
    const { container } = renderCalendarGrid()
    resetVerticalScroll(container)
    const gymEvent = assertDefined(
      (await within(container).findByText('Gym')).closest<HTMLElement>(
        '.fc-event',
      ),
      'Gym event .fc-event ancestor not found',
    )
    const gymRect = gymEvent.getBoundingClientRect()
    hoverPoint(
      gymRect.left + gymRect.width / 2,
      gymRect.top + gymRect.height / 2,
    )
    await waitFor(() => {
      expect(container.querySelector('.tq-slot-hover-ghost')).toBeNull()
    })
  })

  it('does not show a slot ghost when hovering the time-axis column', async () => {
    const { container } = renderCalendarGrid()
    await screen.findByText('API ドキュメント作成')
    const axisCol = assertDefined(
      container.querySelector<HTMLElement>('.fc-timegrid-axis'),
      'time-axis column not found',
    )
    const rect = axisCol.getBoundingClientRect()
    hoverPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    await waitFor(() => {
      expect(container.querySelector('.tq-slot-hover-ghost')).toBeNull()
    })
  })

  it('does not show a slot ghost when hovering the all-day row', async () => {
    const { container } = renderCalendarGrid()
    await screen.findByText('API ドキュメント作成')
    const allDayCell = assertDefined(
      container.querySelector<HTMLElement>('.fc-daygrid-day-frame'),
      'all-day row cell not found',
    )
    const rect = allDayCell.getBoundingClientRect()
    hoverPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    await waitFor(() => {
      expect(container.querySelector('.tq-slot-hover-ghost')).toBeNull()
    })
  })

  it('shows a slot ghost aligned to the column when hovering an empty slot in week view', async () => {
    const { container } = renderCalendarGrid({ activeView: 'week' })
    await screen.findByText('API ドキュメント作成')
    const columns = Array.from(
      container.querySelectorAll<HTMLElement>(
        '.fc-timegrid-col:not(.fc-timegrid-axis)',
      ),
    )
    const otherDayCol = assertDefined(
      columns.find((col) => !col.classList.contains('fc-day-today')),
      'a non-today day column not found',
    )
    const colRect = otherDayCol.getBoundingClientRect()
    const hoverY =
      findVerticalScroller(container).getBoundingClientRect().top + 50
    hoverPoint(colRect.left + colRect.width / 2, hoverY)
    const ghost = await waitFor(() =>
      assertDefined(
        container.querySelector<HTMLElement>('.tq-slot-hover-ghost'),
        'hover ghost not rendered',
      ),
    )
    const ghostRect = ghost.getBoundingClientRect()
    expect(ghostRect.left).toBeCloseTo(colRect.left, 0)
    expect(ghostRect.width).toBeCloseTo(colRect.width, 0)
  })

  it('does not call onTaskClick or onScheduleClick when a gcal event is clicked', async () => {
    const onTaskClick = vi.fn()
    const onScheduleClick = vi.fn()
    const { container } = renderCalendarGrid({ onTaskClick, onScheduleClick })
    const canvas = within(container)
    const user = userEvent.setup()

    await user.click(canvas.getByText('Team standup'))

    expect(onTaskClick).not.toHaveBeenCalled()
    expect(onScheduleClick).not.toHaveBeenCalled()
  })

  it('shows a default cursor on gcal events and a pointer cursor on manual events', async () => {
    const { container } = renderCalendarGrid()
    const canvas = within(container)
    const manualEvent = assertDefined(
      (await canvas.findByText('API ドキュメント作成')).closest('.fc-event'),
      'manual event .fc-event ancestor not found',
    )
    const gcalEvent = assertDefined(
      canvas.getByText('Team standup').closest('.fc-event'),
      'gcal event .fc-event ancestor not found',
    )

    expect(getComputedStyle(gcalEvent).cursor).toBe('default')
    expect(getComputedStyle(manualEvent).cursor).toBe('pointer')
  })

  it('live-updates the drag mirror time label while dragging', async () => {
    const { container } = renderCalendarGrid()
    resetVerticalScroll(container)
    const canvas = within(container)
    const chip = assertDefined(
      (await canvas.findByText('API ドキュメント作成')).closest<HTMLElement>(
        '.fc-event',
      ),
      'manual event .fc-event ancestor not found',
    )
    const chipRect = chip.getBoundingClientRect()
    const x = chipRect.left + chipRect.width / 2
    const y = chipRect.top + chipRect.height / 2

    fireEvent.mouseDown(chip, {
      clientX: x,
      clientY: y,
      button: 0,
      buttons: 1,
    })
    hoverPoint(x, y + 26)

    await waitFor(() => {
      const timeLabel = assertDefined(
        container.querySelector<HTMLElement>(
          '.fc-event-mirror [data-testid="event-time"]',
        ),
        'drag mirror time label not rendered',
      )
      expect(timeLabel.textContent).toBe('09:30–10:30')
    })

    hoverPoint(x, y + 52)

    await waitFor(() => {
      const timeLabel = assertDefined(
        container.querySelector<HTMLElement>(
          '.fc-event-mirror [data-testid="event-time"]',
        ),
        'drag mirror time label not rendered',
      )
      expect(timeLabel.textContent).toBe('10:00–11:00')
    })

    fireEvent.mouseUp(document, { clientX: x, clientY: y + 52 })
  })
})
