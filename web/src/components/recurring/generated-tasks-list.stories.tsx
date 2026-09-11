import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { delay, http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'

import { GeneratedTasksList } from '#components/recurring/generated-tasks-list'
import { makeTask } from '#components/task/task-row-test-fixtures'
import type { Task } from '#hooks/use-tasks'
import { StoryRouter } from '#storybook-config/story-router'

const templateId = '00000000-0000-0000-0000-000000000001'

const sampleTasks: Task[] = [
  makeTask({
    id: 'task-1',
    number: 10,
    title: 'Write weekly report — week 1',
    status: 'completed',
    startDate: '2026-03-09',
    dueDate: '2026-03-13',
    templateId,
  }),
  makeTask({
    id: 'task-2',
    number: 15,
    title: 'Write weekly report — week 2',
    status: 'completed',
    startDate: '2026-03-16',
    dueDate: '2026-03-20',
    templateId,
  }),
  makeTask({
    id: 'task-3',
    number: 20,
    title: 'Write weekly report — week 3',
    status: 'todo',
    startDate: '2026-03-23',
    dueDate: '2026-03-27',
    templateId,
  }),
]

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

const meta = {
  title: 'Recurring/GeneratedTasksList',
  component: GeneratedTasksList,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <Providers>
        <div className="w-full max-w-96">
          <Story />
        </div>
      </Providers>
    ),
  ],
  args: {
    templateId,
  },
} satisfies Meta<typeof GeneratedTasksList>

export default meta
type Story = StoryObj<typeof meta>

export const WithTasks: Story = {
  parameters: {
    msw: {
      handlers: [http.get('/api/tasks', () => HttpResponse.json(sampleTasks))],
    },
  },
}

export const Empty: Story = {
  parameters: {
    msw: {
      handlers: [http.get('/api/tasks', () => HttpResponse.json([]))],
    },
  },
}

export const Loading: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/tasks', async () => {
          await delay('infinite')
          return HttpResponse.json([])
        }),
      ],
    },
  },
}
