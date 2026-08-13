import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn } from 'storybook/test'

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
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Create your first project' }),
    )
    await expect(args.onCreate).toHaveBeenCalledOnce()
  },
}
