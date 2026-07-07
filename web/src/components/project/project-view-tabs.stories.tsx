import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProjectViewTabs } from '@web/components/project/project-view-tabs'
import { fn } from 'storybook/test'

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
