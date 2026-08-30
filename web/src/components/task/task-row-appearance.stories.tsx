import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'

import { TaskRowAppearance } from '#components/task/task-row-appearance'
import type { Task } from '#hooks/use-tasks'
import { StoryRouter } from '#storybook-config/story-router'

const baseTask: Task = {
  id: '00000000-0000-0000-0000-000000000001',
  number: 1,
  title: 'Implement task list UI',
  description: null,
  status: 'todo',
  context: 'personal',
  commitment: 'active',
  labels: [],
  startDate: null,
  dueDate: null,
  estimatedMinutes: null,
  parentId: null,
  parentNumber: null,
  projectId: null,
  recurrenceRuleId: null,
  githubLinks: [],
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  childCompletionCount: { completed: 0, total: 0 },
}

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => <>{children}</>}
        paths={['/tasks/$taskId']}
      />
    </QueryClientProvider>
  )
}

function TaskRowAppearanceWithProviders({ task }: { task: Task }) {
  return (
    <Providers>
      <div className="w-full max-w-3xl">
        <TaskRowAppearance task={task} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/TaskRowAppearance',
  component: TaskRowAppearanceWithProviders,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof TaskRowAppearanceWithProviders>

export default meta
type Story = StoryObj<typeof meta>

export const Todo: Story = {
  args: {
    task: { ...baseTask },
  },
}

export const InProgress: Story = {
  args: {
    task: {
      ...baseTask,
      status: 'in_progress',
      title: 'Review pull request',
    },
  },
}

export const Completed: Story = {
  args: {
    task: {
      ...baseTask,
      status: 'completed',
      title: 'Set up CI pipeline',
    },
  },
}

export const WorkContext: Story = {
  args: {
    task: {
      ...baseTask,
      title: 'Deploy to production',
      context: 'work',
    },
  },
}

export const WithDueDate: Story = {
  args: {
    task: {
      ...baseTask,
      title: 'Submit expense report',
      // Far future so this story never flips to overdue.
      dueDate: '2099-06-15',
    },
  },
}

export const Overdue: Story = {
  args: {
    task: {
      ...baseTask,
      title: 'Renew SSL certificate',
      // Fixed past date so this story always renders as overdue.
      dueDate: '2020-01-01',
    },
  },
}

export const OverdueCompleted: Story = {
  args: {
    task: {
      ...baseTask,
      status: 'completed',
      title: 'Renew SSL certificate',
      dueDate: '2020-01-01',
    },
  },
}

export const WithStartDate: Story = {
  args: {
    task: {
      ...baseTask,
      title: 'Task with a start date',
      startDate: '2026-03-25',
    },
  },
}

export const WithParentTask: Story = {
  args: {
    task: {
      ...baseTask,
      title: 'Task with a parent',
      parentNumber: 12,
    },
  },
}

export const WithEstimate: Story = {
  args: {
    task: {
      ...baseTask,
      title: 'Task with an estimate',
      estimatedMinutes: 90,
    },
  },
}

export const WithGithubLink: Story = {
  args: {
    task: {
      ...baseTask,
      title: 'Fix flaky test',
      githubLinks: [
        {
          id: 'link-1',
          owner: 'fohte',
          repo: 'tq',
          number: 42,
          kind: 'issue',
          url: 'https://github.com/fohte/tq/issues/42',
          state: 'open',
          title: 'Fix flaky test',
          lastSyncedAt: '2026-03-20T00:00:00.000Z',
        },
      ],
    },
  },
}

export const WithTags: Story = {
  args: {
    task: {
      ...baseTask,
      title: 'Ship the release notes',
      labels: ['dev:tq', 'chore'],
    },
  },
}

export const TagClick: Story = {
  args: {
    task: { ...baseTask, title: 'Click a tag token', labels: ['dev:tq'] },
  },
  play: async ({ canvas, userEvent }) => {
    // Clicking navigates to /tasks scoped to the tag; this story only
    // exercises that the click doesn't throw.
    await userEvent.click(canvas.getByText('#dev:tq'))
  },
}

export const WithProject: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/projects/:id', () =>
          HttpResponse.json({
            id: 'project-1',
            title: 'tq',
            description: null,
            status: 'active',
            startDate: null,
            targetDate: null,
            color: null,
            sortOrder: 0,
            createdAt: '2026-03-20T00:00:00.000Z',
            updatedAt: '2026-03-20T00:00:00.000Z',
            completionRate: 0.4,
            taskCount: { total: 10, completed: 4 },
          }),
        ),
      ],
    },
  },
  args: {
    task: {
      ...baseTask,
      title: 'Ship the release notes',
      projectId: 'project-1',
    },
  },
}

export const WithCompletionCount: Story = {
  args: {
    task: {
      ...baseTask,
      title: 'Sprint planning',
      context: 'work',
      childCompletionCount: { completed: 2, total: 3 },
    },
  },
}

export const AllVariants: Story = {
  args: { task: baseTask },
  render: () => {
    const tasks: Task[] = [
      { ...baseTask, id: '1', title: 'Todo task (personal)' },
      {
        ...baseTask,
        id: '2',
        title: 'In progress task',
        status: 'in_progress',
      },
      {
        ...baseTask,
        id: '3',
        title: 'Completed task',
        status: 'completed',
      },
      {
        ...baseTask,
        id: '4',
        title: 'Work context task',
        context: 'work',
      },
      {
        ...baseTask,
        id: '5',
        title: 'Task with children',
        childCompletionCount: { completed: 1, total: 2 },
      },
    ]

    return (
      <Providers>
        <div className="w-full max-w-3xl divide-y divide-border">
          {tasks.map((task) => (
            <TaskRowAppearance key={task.id} task={task} />
          ))}
        </div>
      </Providers>
    )
  },
}
