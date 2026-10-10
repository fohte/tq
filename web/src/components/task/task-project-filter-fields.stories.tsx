import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fn } from 'storybook/test'

import { makeProject } from '#components/project/project-test-fixtures'
import { TaskProjectFilterFields } from '#components/task/task-project-filter-fields'
import type { Project } from '#hooks/use-projects'
import { ALL_PROJECTS_FILTER, projectKeys } from '#hooks/use-projects'

const projectA: Project = makeProject({
  id: 'proj-1',
  title: 'Website Redesign',
})

const projectB: Project = makeProject({ id: 'proj-2', title: 'Mobile App' })
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
})
queryClient.setQueryData(projectKeys.list(ALL_PROJECTS_FILTER), [
  projectA,
  projectB,
])

const meta = {
  title: 'Task/TaskProjectFilterFields',
  component: TaskProjectFilterFields,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="w-64 p-4">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  args: {
    selectedProjectId: undefined,
    onProjectIdChange: fn(),
  },
} satisfies Meta<typeof TaskProjectFilterFields>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'no project is selected in the filter fields',
}

export const ProjectSelected: Story = {
  name: 'a project is selected in the filter fields',
  args: {
    selectedProjectId: 'proj-1',
  },
}
