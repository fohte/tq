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
  args: { status: 'active' },
}

export const Paused: Story = {
  args: { status: 'paused' },
}

export const Completed: Story = {
  args: { status: 'completed' },
}

export const Archived: Story = {
  args: { status: 'archived' },
}

export const AllVariants: Story = {
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
