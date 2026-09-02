import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fn } from 'storybook/test'

import { ProjectFormModal } from '#components/project/project-form-modal'
import { makeProject } from '#components/project/project-test-fixtures'
import type { Project } from '#hooks/use-projects'

const baseProject: Project = makeProject({
  id: '1',
  title: 'ISUCON14',
  description: 'Preparation for ISUCON14 competition',
  startDate: '2024-11-01',
  targetDate: '2024-12-08',
  color: '#FF5C33',
  createdAt: '2024-10-01T00:00:00Z',
  updatedAt: '2024-10-01T00:00:00Z',
})

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const meta = {
  title: 'Project/ProjectFormModal',
  component: ProjectFormModal,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="dark h-screen bg-background">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  args: {
    open: true,
    onOpenChange: fn(),
  },
} satisfies Meta<typeof ProjectFormModal>

export default meta
type Story = StoryObj<typeof meta>

export const Create: Story = {}

export const Edit: Story = {
  args: {
    project: baseProject,
  },
}

export const EditWorkContext: Story = {
  args: {
    project: { ...baseProject, context: 'work' },
  },
}
