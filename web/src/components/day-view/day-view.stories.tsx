import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { expect, fn, within } from 'storybook/test'

import type { TimeBlockEvent } from '#components/calendar/calendar-view'
import { DayViewPresentation } from '#components/day-view/day-view'
import type { Schedule } from '#hooks/use-schedules'
import type { CategorizedTasks, Task } from '#hooks/use-tasks'
import { getQueueCandidates } from '#lib/queue-candidates'
import { atIndex } from '#lib/test-utils'
import { StoryRouter } from '#storybook-config/story-router'

const today = new Date()
const dateStr = `${String(today.getFullYear())}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
const overdueDate = new Date(today)
overdueDate.setDate(overdueDate.getDate() - 3)
const overdueDateStr = `${String(overdueDate.getFullYear())}-${String(overdueDate.getMonth() + 1).padStart(2, '0')}-${String(overdueDate.getDate()).padStart(2, '0')}`

const baseTask: Task = {
  id: '00000000-0000-0000-0000-000000000001',
  number: 1,
  title: '#506 fohte.net を astro で作る',
  description: null,
  status: 'todo',
  context: 'personal',
  labels: [],
  startDate: dateStr,
  dueDate: null,
  estimatedMinutes: 180,
  parentId: null,
  parentNumber: null,
  projectId: null,
  recurrenceRuleId: null,
  githubLink: null,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  childCompletionCount: { completed: 0, total: 0 },
}

const sampleTasks: Task[] = [
  { ...baseTask },
  {
    ...baseTask,
    id: '00000000-0000-0000-0000-000000000002',
    title: '#503 dotfiles 管理ツール整理',
    estimatedMinutes: 120,
    context: 'personal',
  },
  {
    ...baseTask,
    id: '00000000-0000-0000-0000-000000000003',
    title: '投資信託の状況を見直す',
    estimatedMinutes: 60,
    context: 'personal',
  },
  {
    ...baseTask,
    id: '00000000-0000-0000-0000-000000000004',
    title: 'Terraform state リファクタ',
    estimatedMinutes: 45,
    context: 'work',
  },
  {
    ...baseTask,
    id: '00000000-0000-0000-0000-000000000005',
    title: 'sccache ログ確認',
    estimatedMinutes: 15,
    context: 'personal',
    dueDate: overdueDateStr,
  },
  {
    ...baseTask,
    id: '00000000-0000-0000-0000-000000000006',
    title: 'cache hit rate 改善',
    estimatedMinutes: 30,
    context: 'personal',
  },
  {
    ...baseTask,
    id: '00000000-0000-0000-0000-000000000007',
    title: 'ブログ記事を書く',
    estimatedMinutes: null,
    context: 'personal',
  },
  {
    ...baseTask,
    id: '00000000-0000-0000-0000-000000000008',
    title: '歯医者の予約',
    estimatedMinutes: null,
    context: 'personal',
  },
]

const noDateTasks: Task[] = [
  {
    ...baseTask,
    id: '00000000-0000-0000-0000-000000000101',
    title: 'タスク管理アプリの UX 見直し',
    status: 'todo',
    startDate: null,
    estimatedMinutes: null,
    context: 'personal',
  },
  {
    ...baseTask,
    id: '00000000-0000-0000-0000-000000000102',
    title: 'CI パイプライン最適化',
    status: 'todo',
    startDate: null,
    estimatedMinutes: null,
    context: 'personal',
  },
]

const sampleCategorized: CategorizedTasks = {
  all: [...sampleTasks, ...noDateTasks],
}

const sampleEvents: TimeBlockEvent[] = [
  {
    id: 'tb-1',
    title: 'Sleep',
    start: `${dateStr}T00:00:00`,
    end: `${dateStr}T07:00:00`,
    type: 'schedule',
    color: { accent: '#6C63FF' },
    scheduleId: 'sched-sleep',
  },
  {
    id: 'tb-2',
    title: '#513 cc watch の認知負荷を下げる',
    start: `${dateStr}T08:30:00`,
    end: `${dateStr}T10:00:00`,
    type: 'completed',
  },
  {
    id: 'tb-3',
    title: 'Team Standup',
    start: `${dateStr}T10:00:00`,
    end: `${dateStr}T10:30:00`,
    type: 'gcal',
  },
  {
    id: 'tb-4',
    title: '#507 ビルド改善',
    start: `${dateStr}T10:30:00`,
    end: `${dateStr}T11:30:00`,
    type: 'manual',
    parentRef: '#488 tq 作成',
  },
  {
    id: 'tb-5',
    title: 'Lunch',
    start: `${dateStr}T12:00:00`,
    end: `${dateStr}T13:00:00`,
    type: 'gcal',
  },
  {
    id: 'tb-6',
    title: '#508 テスト追加',
    start: `${dateStr}T13:00:00`,
    end: `${dateStr}T13:45:00`,
    type: 'auto',
  },
  {
    id: 'tb-7',
    title: '#509 CI 修正',
    start: `${dateStr}T13:45:00`,
    end: `${dateStr}T14:15:00`,
    type: 'auto',
  },
  {
    id: 'tb-8',
    title: 'Gym',
    start: `${dateStr}T18:00:00`,
    end: `${dateStr}T19:00:00`,
    type: 'schedule',
    color: { accent: '#52B788' },
    scheduleId: 'sched-gym',
  },
  {
    id: 'tb-9',
    title: '#511 通院の準備',
    start: `${dateStr}T15:00:00`,
    end: `${dateStr}T16:00:00`,
    type: 'manual',
    redacted: true,
  },
]

const sampleSchedules: Schedule[] = [
  {
    scheduleId: 'sched-sleep',
    title: 'Sleep',
    start: `${dateStr}T00:00:00`,
    end: `${dateStr}T07:00:00`,
    context: 'personal',
    color: '#6C63FF',
    recurrence: {
      id: 'rule-sleep',
      type: 'daily',
      interval: 1,
      daysOfWeek: null,
      dayOfMonth: null,
    },
  },
  {
    scheduleId: 'sched-gym',
    title: 'Gym',
    start: `${dateStr}T18:00:00`,
    end: `${dateStr}T19:00:00`,
    context: 'personal',
    color: '#52B788',
    recurrence: null,
  },
]

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => <>{children}</>}
        paths={['/tasks', '/tasks/$taskId']}
      />
    </QueryClientProvider>
  )
}

const meta = {
  title: 'Page/DayView',
  component: DayViewPresentation,
  parameters: {
    layout: 'fullscreen',
    // FullCalendar's internal `.fc-scroller` reports scrollWidth > clientWidth
    // by a fixed ~80px whenever its vertical scrollbar is forced on — a
    // library-internal scrollbar-gutter sizing artifact, not app layout (same
    // cause as CalendarGrid/CalendarView's disable).
    overflowCheck: { ignoreSelectors: ['.fc-scroller'] },
  },
  decorators: [
    (Story) => (
      <Providers>
        <div style={{ height: '100vh' }}>
          <Story />
        </div>
      </Providers>
    ),
  ],
  args: {
    selectedDate: today,
    onDateChange: fn(),
  },
} satisfies Meta<typeof DayViewPresentation>

export default meta
type Story = StoryObj<typeof meta>

const queuedTasks = sampleTasks.slice(0, 4)
const queuedTaskIds = new Set(queuedTasks.map((t) => t.id))
const queueCandidates = getQueueCandidates(
  sampleCategorized.all,
  queuedTaskIds,
  today,
)

export const Default: Story = {
  args: {
    isLoading: false,
    calendarEvents: sampleEvents,
    schedules: sampleSchedules,
    dndCallbacks: {
      onEventDrop: fn(),
      onEventResize: fn(),
      onExternalDrop: fn(),
    },
    queueTasks: queuedTasks,
    queueCandidates,
    onReorderQueue: fn(),
    onInsertCandidate: fn(),
    onToggleQueueTask: fn(),
    onRemoveFromQueue: fn(),
    onAutoAssign: fn(),
    isAutoAssigning: false,
  },
}

export const OpensCreateScheduleModal: Story = {
  args: Default.args,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByLabelText('New schedule'))

    const body = within(canvasElement.ownerDocument.body)
    await expect(
      atIndex(await body.findAllByPlaceholderText('Schedule title'), 0),
    ).toBeVisible()
  },
}

export const OpensEditScheduleModal: Story = {
  args: Default.args,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(await canvas.findByText('Sleep'))

    const body = within(canvasElement.ownerDocument.body)
    await expect(
      atIndex(await body.findAllByPlaceholderText('Schedule title'), 0),
    ).toHaveValue('Sleep')
  },
}

export const Loading: Story = {
  args: {
    isLoading: true,
    calendarEvents: [],
    schedules: [],
    queueTasks: [],
    queueCandidates: [],
    onReorderQueue: fn(),
    onInsertCandidate: fn(),
    onToggleQueueTask: fn(),
    onRemoveFromQueue: fn(),
    onAutoAssign: fn(),
    isAutoAssigning: false,
  },
}

export const Empty: Story = {
  args: {
    isLoading: false,
    calendarEvents: [],
    schedules: [],
    queueTasks: [],
    queueCandidates: [],
    onReorderQueue: fn(),
    onInsertCandidate: fn(),
    onToggleQueueTask: fn(),
    onRemoveFromQueue: fn(),
    onAutoAssign: fn(),
    isAutoAssigning: false,
  },
}

export const EmptyQueueWithCandidates: Story = {
  args: {
    isLoading: false,
    calendarEvents: [],
    schedules: [],
    queueTasks: [],
    queueCandidates: getQueueCandidates(
      sampleCategorized.all,
      new Set(),
      today,
    ),
    onReorderQueue: fn(),
    onInsertCandidate: fn(),
    onToggleQueueTask: fn(),
    onRemoveFromQueue: fn(),
    onAutoAssign: fn(),
    isAutoAssigning: false,
  },
}
