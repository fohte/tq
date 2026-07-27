import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { ProjectViewTabs } from '#components/project/project-view-tabs'

const meta = {
  title: 'Project/ProjectViewTabs',
  component: ProjectViewTabs,
  parameters: {
    layout: 'centered',
  },
  args: {
    onViewChange: fn(),
  },
} satisfies Meta<typeof ProjectViewTabs>

export default meta
type Story = StoryObj<typeof meta>

export const ListView: Story = {
  args: {
    view: 'list',
  },
}

export const GanttView: Story = {
  args: {
    view: 'gantt',
  },
}
