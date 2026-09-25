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
  name: 'a project status mark indicates active work',
  args: { status: 'active' },
}

export const Completed: Story = {
  name: 'a project status mark indicates completed work',
  args: { status: 'completed' },
}

// `paused` and `archived` are intentionally styled identically (see
// project-status-mark.tsx).
export const PausedAndArchived: Story = {
  name: 'paused and archived projects share the same status mark',
  args: { status: 'paused' },
  render: () => (
    <div className="flex items-center gap-4">
      <ProjectStatusMark status="paused" />
      <ProjectStatusMark status="archived" />
    </div>
  ),
}

export const Large: Story = {
  name: 'an active project status mark appears at a larger size',
  args: { status: 'active', size: 9 },
}

export const AllVariants: Story = {
  name: 'project status marks compare active, paused, completed, and archived states',
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
