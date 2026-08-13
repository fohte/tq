import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { TaskListToolbar } from '#components/task/task-list-toolbar'
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

const projects = [projectA, projectB]

const meta = {
  title: 'Task/TaskListToolbar',
  component: TaskListToolbar,
  parameters: {
    layout: 'centered',
  },
  args: {
    showCompleted: false,
    onShowCompletedChange: fn(),
    sortBy: 'updated',
    onSortByChange: fn(),
    projects,
    projectId: undefined,
    onProjectIdChange: fn(),
    onCreateFromGithub: fn(),
    onCreateNew: fn(),
  },
} satisfies Meta<typeof TaskListToolbar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ShowCompleted: Story = {
  args: {
    showCompleted: true,
  },
}

export const SortByCreated: Story = {
  args: {
    sortBy: 'created',
  },
}

export const ProjectSelected: Story = {
  args: {
    projectId: 'proj-1',
  },
}

export const NoProjects: Story = {
  args: {
    projects: [],
  },
}
