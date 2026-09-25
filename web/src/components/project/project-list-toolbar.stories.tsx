import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { ProjectListToolbar } from '#components/project/project-list-toolbar'

const meta = {
  title: 'Project/ProjectListToolbar',
  component: ProjectListToolbar,
  parameters: {
    layout: 'centered',
  },
  args: {
    onFilterChange: fn(),
    onCreate: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProjectListToolbar>

export default meta
type Story = StoryObj<typeof meta>

export const Active: Story = {
  name: 'the project toolbar filters the list to active projects',
  args: {
    filter: 'active',
  },
}

export const All: Story = {
  name: 'the project toolbar shows every project status',
  args: {
    filter: 'all',
  },
}
