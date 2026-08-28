import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'

import { TaskProjectLabel } from '#components/task/task-row-shared'
import type { ProjectDetail } from '#hooks/use-projects'
import { projectKeys } from '#hooks/use-projects'

const sampleProject: ProjectDetail = {
  id: 'aaaa0000-0000-0000-0000-000000000000',
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
}

function TaskProjectLabelStory({ projectId }: { projectId: string }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(projectKeys.detail(sampleProject.id), sampleProject)

  return (
    <QueryClientProvider client={queryClient}>
      <TaskProjectLabel projectId={projectId} />
    </QueryClientProvider>
  )
}

const meta = {
  title: 'Task/TaskProjectLabel',
  component: TaskProjectLabelStory,
  parameters: {
    layout: 'centered',
    msw: {
      handlers: [
        http.get('/api/projects/:id', ({ params }) =>
          params['id'] === sampleProject.id
            ? HttpResponse.json(sampleProject)
            : HttpResponse.json(
                { error: 'Project not found' },
                { status: 404 },
              ),
        ),
      ],
    },
  },
} satisfies Meta<typeof TaskProjectLabelStory>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { projectId: sampleProject.id },
}
