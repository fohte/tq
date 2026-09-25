import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { makeProject } from '#components/project/project-test-fixtures'
import { TaskProjectFilterFields } from '#components/task/task-project-filter-fields'
import type { Project } from '#hooks/use-projects'

const projectA: Project = makeProject({
  id: 'proj-1',
  title: 'Website Redesign',
})

const projectB: Project = makeProject({ id: 'proj-2', title: 'Mobile App' })

const meta = {
  title: 'Task/TaskProjectFilterFields',
  component: TaskProjectFilterFields,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="w-64 p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    projects: [projectA, projectB],
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
