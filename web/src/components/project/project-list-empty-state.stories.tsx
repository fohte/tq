import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { ProjectListEmptyState } from '#components/project/project-list-empty-state'

const meta = {
  title: 'Project/ProjectListEmptyState',
  component: ProjectListEmptyState,
  parameters: {
    layout: 'centered',
  },
  args: {
    onCreate: fn(),
  },
} satisfies Meta<typeof ProjectListEmptyState>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'the project list invites the user to create the first project',
}
