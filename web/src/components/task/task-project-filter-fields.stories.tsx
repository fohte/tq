import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent } from 'storybook/test'

import { TaskProjectFilterFields } from '#components/task/task-project-filter-fields'
import type { Project } from '#hooks/use-projects'

const projectA: Project = {
  id: 'proj-1',
  title: 'Website Redesign',
  description: null,
  status: 'active',
  startDate: null,
  targetDate: null,
  color: null,
  sortOrder: 0,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  taskCount: { total: 0, completed: 0 },
  completionRate: 0,
}

const projectB: Project = {
  ...projectA,
  id: 'proj-2',
  title: 'Mobile App',
}

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

export const Default: Story = {}

export const ProjectSelected: Story = {
  args: {
    selectedProjectId: 'proj-1',
  },
}

export const SelectProject: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Mobile App' }))
    await expect(args.onProjectIdChange).toHaveBeenCalledWith('proj-2')
  },
}

export const ClearProject: Story = {
  args: {
    selectedProjectId: 'proj-1',
  },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'All projects' }))
    await expect(args.onProjectIdChange).toHaveBeenCalledWith('')
  },
}
