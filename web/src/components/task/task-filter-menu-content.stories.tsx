import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent } from 'storybook/test'

import { TaskFilterMenuContent } from '#components/task/task-filter-menu-content'
import type { Project } from '#hooks/use-projects'
import { StoryRouter } from '#storybook-config/story-router'

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

const projects = [projectA, projectB]

const meta = {
  title: 'Task/TaskFilterMenuContent',
  component: TaskFilterMenuContent,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="flex w-64 flex-col gap-5 p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    showCompleted: false,
    onShowCompletedChange: fn(),
    sortBy: 'updated',
    onSortByChange: fn(),
    projects,
    selectedProjectId: undefined,
    onProjectIdChange: fn(),
    showContext: false,
  },
} satisfies Meta<typeof TaskFilterMenuContent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

// Rendered directly (not behind FilterMenu's useIsDesktop), so this is the
// only place the mobile-only CONTEXT section gets VRT coverage.
export const WithContext: Story = {
  args: {
    showContext: true,
  },
  render: (args) => (
    <StoryRouter component={() => <TaskFilterMenuContent {...args} />} />
  ),
}

export const ProjectSelected: Story = {
  args: {
    selectedProjectId: 'proj-1',
  },
}

export const NoProjects: Story = {
  args: {
    projects: [],
  },
}

export const CheckShowCompleted: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(
      canvas.getByRole('checkbox', { name: 'show completed' }),
    )
    // Base UI's Checkbox passes a second `eventDetails` argument alongside
    // the checked value.
    await expect(args.onShowCompletedChange).toHaveBeenCalledWith(
      true,
      expect.anything(),
    )
  },
}

export const ChangeSort: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Created' }))
    await expect(args.onSortByChange).toHaveBeenCalledWith('created')
  },
}

export const SelectProject: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Mobile App' }))
    await expect(args.onProjectIdChange).toHaveBeenCalledWith('proj-2')
  },
}
