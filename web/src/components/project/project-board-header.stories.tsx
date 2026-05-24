import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProjectBoardHeader } from '@web/components/project/project-board-header'
import type { ProjectDetail } from '@web/hooks/use-projects'

const baseProject: ProjectDetail = {
  id: '00000000-0000-0000-0000-000000000001',
  title: 'Website Redesign',
  description: 'Redesign the company website',
  status: 'active',
  startDate: '2024-11-01',
  targetDate: '2024-12-08',
  color: '#FF8400',
  sortOrder: 0,
  createdAt: '2024-10-15T00:00:00.000Z',
  updatedAt: '2024-11-01T00:00:00.000Z',
  completionRate: 0.67,
  taskCount: { total: 30, completed: 20 },
}

const meta = {
  title: 'Project/ProjectBoardHeader',
  component: ProjectBoardHeader,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="w-[600px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProjectBoardHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Active: Story = {
  args: { project: baseProject },
}

export const Paused: Story = {
  args: {
    project: {
      ...baseProject,
      title: 'API Migration',
      status: 'paused',
      color: '#B2B2FF',
      completionRate: 0.3,
      taskCount: { total: 10, completed: 3 },
    },
  },
}

export const Completed: Story = {
  args: {
    project: {
      ...baseProject,
      title: 'CI/CD Setup',
      status: 'completed',
      color: '#4CAF50',
      completionRate: 1,
      taskCount: { total: 8, completed: 8 },
    },
  },
}

export const NoTasks: Story = {
  args: {
    project: {
      ...baseProject,
      title: 'New Project',
      completionRate: 0,
      taskCount: { total: 0, completed: 0 },
    },
  },
}

export const NoDates: Story = {
  args: {
    project: {
      ...baseProject,
      title: 'Research Spike',
      startDate: null,
      targetDate: null,
    },
  },
}

export const NoColor: Story = {
  args: {
    project: {
      ...baseProject,
      title: 'Plain Project',
      color: null,
    },
  },
}
