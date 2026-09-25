import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'

import { makeProject } from '#components/project/project-test-fixtures'
import { makeGithubLink } from '#components/task/github-link-test-fixtures'
import { TaskRowAppearance } from '#components/task/task-row-appearance'
import { makeTask } from '#components/task/task-row-test-fixtures'
import type { Task } from '#hooks/use-tasks'
import { StoryRouter } from '#storybook-config/story-router'

const baseTask: Task = makeTask({
  id: '00000000-0000-0000-0000-000000000001',
  title: 'Implement task list UI',
})

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
  name: 'the row shows a task that is not yet complete.',
  args: {
    task: { ...baseTask },
  },
}

export const Completed: Story = {
  name: 'the row shows a completed task.',
  args: {
    task: {
      ...baseTask,
      status: 'completed',
      title: 'Set up CI pipeline',
    },
  },
}

export const NotPlanned: Story = {
  name: 'the row marks a task as not planned.',
  args: {
    task: {
      ...baseTask,
      status: 'completed',
      statusReason: 'not_planned',
      title: 'Redesign the onboarding flow',
    },
  },
}

export const Duplicate: Story = {
  name: 'the row marks a completed task as a duplicate.',
  args: {
    task: {
      ...baseTask,
      status: 'completed',
      statusReason: 'duplicate',
      title: 'Set up CI pipeline',
    },
  },
}

export const DuplicateOfNumber: Story = {
  name: 'the row links a duplicate task to its original task number.',
  args: {
    task: {
      ...baseTask,
      status: 'completed',
      statusReason: 'duplicate',
      duplicateOfNumber: 42,
      title: 'Set up CI pipeline',
    },
  },
}

export const WorkContext: Story = {
  name: 'the row marks a task as belonging to the work context.',
  args: {
    task: {
      ...baseTask,
      title: 'Deploy to production',
      context: 'work',
    },
  },
}

export const WithDueDate: Story = {
  name: 'the row shows a task with a future due date.',
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
  name: 'the row highlights a task whose due date has passed.',
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
  name: 'the row shows a due date for a completed task.',
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
  name: 'the row shows a task with a start date.',
  args: {
    task: {
      ...baseTask,
      title: 'Task with a start date',
      startDate: '2026-03-25',
    },
  },
}

export const WithDateRange: Story = {
  name: 'the row shows a task with a start date and due date.',
  args: {
    task: {
      ...baseTask,
      title: 'Task with a start date and a due date',
      startDate: '2026-03-25',
      // Far future so this story never flips to overdue.
      dueDate: '2099-06-15',
    },
  },
}

export const WithRemindAt: Story = {
  name: 'the row shows the task reminder date and time.',
  args: {
    task: {
      ...baseTask,
      title: 'Task with a reminder',
      // Far future so this story always renders the same absolute date/time.
      remindAt: '2099-06-15T09:00:00.000Z',
    },
  },
}

export const WithParentTask: Story = {
  name: 'the row shows its parent task number.',
  args: {
    task: {
      ...baseTask,
      title: 'Task with a parent',
      parentNumber: 12,
    },
  },
}

export const WithBlockedBy: Story = {
  name: 'the row indicates that another task blocks it.',
  args: {
    task: {
      ...baseTask,
      title: 'Task blocked by another task',
      blockedByNumbers: [312],
    },
  },
}

export const WithMultipleBlockedBy: Story = {
  name: 'the row lists multiple tasks that block it.',
  args: {
    task: {
      ...baseTask,
      title: 'Task blocked by multiple tasks',
      blockedByNumbers: [312, 315],
    },
  },
}

export const WithEstimate: Story = {
  name: 'the row shows a task estimate.',
  args: {
    task: {
      ...baseTask,
      title: 'Task with an estimate',
      estimatedMinutes: 90,
    },
  },
}

export const WithRecurrence: Story = {
  name: 'the row shows a task with a weekly recurrence.',
  args: {
    task: {
      ...baseTask,
      title: 'Water the plants',
      recurrenceRule: {
        id: 'recurrence-1',
        type: 'weekly',
        interval: 1,
        daysOfWeek: [0, 3],
        dayOfMonth: null,
      },
    },
  },
}

export const WithGithubLink: Story = {
  name: 'the row shows a task linked to a GitHub pull request.',
  args: {
    task: {
      ...baseTask,
      title: 'Fix flaky test',
      githubLinks: [makeGithubLink({ title: 'Fix flaky test' })],
    },
  },
}

export const WithMultipleGithubLinks: Story = {
  name: 'the row shows a task linked to an issue and a pull request.',
  args: {
    task: {
      ...baseTask,
      title: 'Add multi-link support',
      githubLinks: [
        makeGithubLink({
          number: 412,
          url: 'https://github.com/fohte/tq/issues/412',
          title: 'Support multiple GitHub links per task',
        }),
        makeGithubLink({
          id: 'link-2',
          number: 436,
          kind: 'pull_request',
          url: 'https://github.com/fohte/tq/pull/436',
          state: 'merged',
          title: 'api: allow associating multiple GitHub links with a task',
        }),
      ],
    },
  },
}

export const WithTags: Story = {
  name: 'the row shows a task with two labels.',
  args: {
    task: {
      ...baseTask,
      title: 'Ship the release notes',
      labels: ['dev:tq', 'chore'],
    },
  },
}

export const WithProject: Story = {
  name: 'the row shows a task linked to a project.',
  parameters: {
    msw: {
      handlers: [
        http.get('/api/projects/:id', () =>
          HttpResponse.json(
            makeProject({
              id: 'project-1',
              completionRate: 0.4,
              taskCount: { total: 10, completed: 4 },
            }),
          ),
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
  name: 'the row shows how many subtasks are complete.',
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
  name: 'the rows show personal, completed, work, and parent tasks.',
  args: { task: baseTask },
  render: () => {
    const tasks: Task[] = [
      { ...baseTask, id: '1', title: 'Todo task (personal)' },
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
