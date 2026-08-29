import type { Meta, StoryObj } from '@storybook/react-vite'

import { ProjectStatusMark } from '#components/project/project-status-mark'

const meta = {
  title: 'Project/ProjectStatusMark',
  component: ProjectStatusMark,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    status: {
      control: 'select',
      options: ['active', 'paused', 'completed', 'archived'],
    },
    size: {
      control: 'select',
      options: [7, 9],
    },
  },
} satisfies Meta<typeof ProjectStatusMark>

export default meta
type Story = StoryObj<typeof meta>

export const Active: Story = {
  args: { status: 'active' },
}

export const Completed: Story = {
  args: { status: 'completed' },
}

// `paused` and `archived` are intentionally styled identically (see
// project-status-mark.tsx), so they're covered by one combined story instead
// of two stories that would render to the same screenshot.
export const PausedAndArchived: Story = {
  args: { status: 'paused' },
  render: () => (
    <div className="flex items-center gap-4">
      <ProjectStatusMark status="paused" />
      <ProjectStatusMark status="archived" />
    </div>
  ),
}

export const Large: Story = {
  args: { status: 'active', size: 9 },
}

export const AllVariants: Story = {
  args: { status: 'active' },
  render: () => (
    <div className="flex items-center gap-4">
      <ProjectStatusMark status="active" />
      <ProjectStatusMark status="paused" />
      <ProjectStatusMark status="completed" />
      <ProjectStatusMark status="archived" />
      <ProjectStatusMark status="active" size={9} />
    </div>
  ),
}
