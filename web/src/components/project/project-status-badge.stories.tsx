import type { Meta, StoryObj } from '@storybook/react-vite'

import { ProjectStatusBadge } from '#components/project/project-status-badge'

const meta = {
  title: 'Project/ProjectStatusBadge',
  component: ProjectStatusBadge,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="dark bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProjectStatusBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Active: Story = {
  name: 'a project status badge marks an active project',
  args: { status: 'active' },
}

export const Paused: Story = {
  name: 'a project status badge marks a paused project',
  args: { status: 'paused' },
}

export const Completed: Story = {
  name: 'a project status badge marks a completed project',
  args: { status: 'completed' },
}

export const Archived: Story = {
  name: 'a project status badge marks an archived project',
  args: { status: 'archived' },
}

export const AllVariants: Story = {
  name: 'project status badges compare all four project states',
  args: { status: 'active' },
  render: () => (
    <div className="flex items-center gap-3">
      <ProjectStatusBadge status="active" />
      <ProjectStatusBadge status="paused" />
      <ProjectStatusBadge status="completed" />
      <ProjectStatusBadge status="archived" />
    </div>
  ),
}
