import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import type { TimeBlockEvent } from '@web/components/calendar/calendar-view'
import { DayViewPresentation } from '@web/components/day-view/day-view'
import type { CategorizedTasks, Task } from '@web/hooks/use-tasks'
import type { ReactNode } from 'react'
import { fn } from 'storybook/test'

const today = new Date()
const dateStr = `${String(today.getFullYear())}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

const baseTask: Task = {
  id: '00000000-0000-0000-0000-000000000001',
  title: '#506 fohte.net を astro で作る',
  description: null,
  status: 'todo',
  context: 'dev',
  startDate: dateStr,
  dueDate: null,
  estimatedMinutes: 180,
  parentId: null,
  projectId: null,
  sortOrder: 0,
  recurrenceRuleId: null,
  recurrenceRule: null,
  createdAt: '2026-03-20T00:00:00.000Z',
  activeTimeBlockStartTime: null,
  updatedAt: '2026-03-20T00:00:00.000Z',
}

const sampleTasks: Task[] = [
  { ...baseTask },
  {
    ...baseTask,
    id: '00000000-0000-0000-0000-000000000002',
    title: '#503 dotfiles 管理ツール整理',
    estimatedMinutes: 120,
    context: 'dev',
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
    context: 'dev',
  },
  {
    ...baseTask,
    id: '00000000-0000-0000-0000-000000000006',
    title: 'cache hit rate 改善',
    estimatedMinutes: 30,
    context: 'dev',
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

const backlogTasks: Task[] = [
  {
    ...baseTask,
    id: '00000000-0000-0000-0000-000000000101',
    title: 'タスク管理アプリの UX 見直し',
    status: 'todo',
    startDate: null,
    estimatedMinutes: null,
    context: 'dev',
  },
  {
    ...baseTask,
    id: '00000000-0000-0000-0000-000000000102',
    title: 'CI パイプライン最適化',
    status: 'todo',
    startDate: null,
    estimatedMinutes: null,
    context: 'dev',
  },
]

const sampleCategorized: CategorizedTasks = {
  all: [...sampleTasks, ...backlogTasks],
  today: sampleTasks,
  backlog: backlogTasks,
  nonBacklog: sampleTasks,
}

const sampleEvents: TimeBlockEvent[] = [
  {
    id: 'tb-1',
    title: 'Sleep',
    start: `${dateStr}T00:00:00`,
    end: `${dateStr}T07:00:00`,
    type: 'schedule',
    color: { bg: '#2D2B55', accent: '#6C63FF' },
    icon: 'moon',
  },
  {
    id: 'tb-2',
    title: '#513 cc watch の認知負荷を下げる',
    start: `${dateStr}T08:30:00`,
    end: `${dateStr}T10:00:00`,
    type: 'completed',
    duration: '2h',
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
    duration: '1h',
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
    duration: '45m',
  },
  {
    id: 'tb-7',
    title: '#509 CI 修正',
    start: `${dateStr}T13:45:00`,
    end: `${dateStr}T14:15:00`,
    type: 'auto',
    duration: '30m',
  },
  {
    id: 'tb-8',
    title: 'Gym',
    start: `${dateStr}T18:00:00`,
    end: `${dateStr}T19:00:00`,
    type: 'schedule',
    color: { bg: '#1B4332', accent: '#52B788' },
    icon: 'dumbbell',
  },
]

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const rootRoute = createRootRoute({
    component: () => <>{children}</>,
  })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  })
  const taskRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks/$taskId',
    component: () => null,
  })
  rootRoute.addChildren([indexRoute, taskRoute])

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

const meta = {
  title: 'Page/DayView',
  component: DayViewPresentation,
  parameters: {
    layout: 'fullscreen',
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
} satisfies Meta<typeof DayViewPresentation>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    isLoading: false,
    categorized: sampleCategorized,
    calendarEvents: sampleEvents,
    dndCallbacks: {
      onEventDrop: fn(),
      onEventResize: fn(),
      onExternalDrop: fn(),
    },
  },
}

export const Loading: Story = {
  args: {
    isLoading: true,
    categorized: { all: [], today: [], backlog: [], nonBacklog: [] },
    calendarEvents: [],
  },
}

export const Empty: Story = {
  args: {
    isLoading: false,
    categorized: { all: [], today: [], backlog: [], nonBacklog: [] },
    calendarEvents: [],
  },
}
