import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { SidebarProjectField } from '#components/task/sidebar-project-field'
import { type Project, projectKeys } from '#hooks/use-projects'

const taskId = '00000000-0000-0000-0000-000000000001'

const projectA: Project = {
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

const projectB: Project = {
  ...projectA,
  id: 'bbbb0000-0000-0000-0000-000000000000',
  title: 'Website redesign',
}

function createSeededQueryClient(projects: Project[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(projectKeys.list(undefined), projects)
  return client
}

const meta = {
  title: 'Task/TaskDetail/SidebarProjectField',
  component: SidebarProjectField,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="relative w-56 border-l border-border p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SidebarProjectField>

export default meta
type Story = StoryObj<typeof meta>

export const NoProject: Story = {
  args: {
    taskId,
    projectId: null,
  },
  decorators: [
    (Story) => (
      <QueryClientProvider
        client={createSeededQueryClient([projectA, projectB])}
      >
        <Story />
      </QueryClientProvider>
    ),
  ],
}

export const WithProject: Story = {
  args: {
    taskId,
    projectId: projectA.id,
  },
  decorators: [
    (Story) => (
      <QueryClientProvider
        client={createSeededQueryClient([projectA, projectB])}
      >
        <Story />
      </QueryClientProvider>
    ),
  ],
}
