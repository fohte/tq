import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'

import { ProjectGanttView } from '#components/project/project-gantt-view'
import type { ProjectTask } from '#hooks/use-projects'
import { MemoizedStoryRouter } from '#storybook-config/story-router'

function formatDateOffset(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const baseTask: ProjectTask = {
  id: '1',
  number: 1,
  title: 'Task',
  description: null,
  status: 'todo',
  context: 'personal',
  labels: [],
  startDate: null,
  dueDate: null,
  estimatedMinutes: null,
  parentId: null,
  parentNumber: null,
  projectId: 'p1',
  recurrenceRuleId: null,
  githubLinks: [],
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  childCompletionCount: { completed: 0, total: 0 },
}

const sampleTasks: ProjectTask[] = [
  {
    ...baseTask,
    id: '1',
    number: 1,
    title: 'Design',
    status: 'completed',
    startDate: formatDateOffset(-7),
    dueDate: formatDateOffset(-3),
  },
  {
    ...baseTask,
    id: '2',
    number: 2,
    title: 'Implementation',
    status: 'in_progress',
    startDate: formatDateOffset(-2),
    dueDate: formatDateOffset(3),
  },
  {
    ...baseTask,
    id: '2-1',
    number: 3,
    title: 'API',
    parentId: '2',
    parentNumber: 2,
    status: 'in_progress',
    startDate: formatDateOffset(-2),
    dueDate: formatDateOffset(0),
  },
  {
    ...baseTask,
    id: '2-2',
    number: 4,
    title: 'UI',
    parentId: '2',
    parentNumber: 2,
    status: 'todo',
    startDate: formatDateOffset(0),
    dueDate: formatDateOffset(3),
  },
  {
    ...baseTask,
    id: '3',
    number: 5,
    title: 'Launch',
    status: 'todo',
    startDate: formatDateOffset(5),
    dueDate: formatDateOffset(6),
  },
  {
    ...baseTask,
    id: '4',
    number: 6,
    title: 'Backlog idea',
    status: 'todo',
  },
]

function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <MemoizedStoryRouter paths={['/tasks/$taskId']}>
        {children}
      </MemoizedStoryRouter>
    </QueryClientProvider>
  )
}

function ProjectGanttViewWithProviders({ tasks }: { tasks: ProjectTask[] }) {
  return (
    <Providers>
      <div style={{ height: '600px' }}>
        <ProjectGanttView tasks={tasks} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Project/ProjectGanttView',
  component: ProjectGanttViewWithProviders,
  parameters: {
    layout: 'fullscreen',
    // `.wx-gantt` is @svar-ui/react-gantt's internal wrapper. Overflow
    // reported inside it comes from its `.wx-stuck` descendant holding a
    // stale ResizeObserver-derived inline width — a library-internal
    // sizing artifact, not app layout, and not something tq's code can
    // fix. It doesn't depend on story data (`.wx-chart`, the timeline's
    // own horizontal scroll viewport, is inside `.wx-gantt` and covered
    // by the same exclusion). ProjectGanttView's own toolbar (the Today
    // button, the TabStrip) sits outside `.wx-gantt` and stays checked.
    // `.wx-gantt *` is needed alongside `.wx-gantt` itself because
    // ignoreSelectors only exempts the elements it matches, not their
    // descendants.
    overflowCheck: { ignoreSelectors: ['.wx-gantt', '.wx-gantt *'] },
  },
} satisfies Meta<typeof ProjectGanttViewWithProviders>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    tasks: sampleTasks,
  },
}

export const Empty: Story = {
  args: {
    tasks: [],
  },
}
