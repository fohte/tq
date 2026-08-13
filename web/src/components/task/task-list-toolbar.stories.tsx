import type { Meta, StoryObj } from '@storybook/react-vite'

import { TaskListToolbar } from '#components/task/task-list-toolbar'
import type { Project } from '#hooks/use-projects'

const projects: Project[] = [
  {
    id: 'proj-1',
    title: 'Website Redesign',
    description: null,
    status: 'active',
    startDate: null,
    targetDate: null,
    color: '#FF5C33',
    sortOrder: 0,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    taskCount: { total: 12, completed: 5 },
    completionRate: 5 / 12,
  },
  {
    id: 'proj-2',
    title: 'Mobile App',
    description: null,
    status: 'active',
    startDate: null,
    targetDate: null,
    color: '#4A90D9',
    sortOrder: 1,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    taskCount: { total: 8, completed: 2 },
    completionRate: 2 / 8,
  },
]

const meta = {
  title: 'Task/TaskListToolbar',
  component: TaskListToolbar,
  parameters: {
    layout: 'centered',
  },
  args: {
    showCompleted: false,
    onShowCompletedChange: () => {},
    sortBy: 'updated',
    onSortByChange: () => {},
    projects,
    projectId: undefined,
    onProjectIdChange: () => {},
    onCreateFromGithub: () => {},
    onCreateNew: () => {},
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
