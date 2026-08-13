import type { Meta, StoryObj } from '@storybook/react-vite'

import { ProjectListEmptyState } from '#components/project/project-list-empty-state'

const meta = {
  title: 'Project/ProjectListEmptyState',
  component: ProjectListEmptyState,
  parameters: {
    layout: 'centered',
  },
  args: {
    onCreate: () => {},
  },
} satisfies Meta<typeof ProjectListEmptyState>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
