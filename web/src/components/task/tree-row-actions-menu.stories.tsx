import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { TreeRowActionsMenu } from '#components/task/tree-row-actions-menu'

const meta = {
  title: 'Task/TreeRowActionsMenu',
  component: TreeRowActionsMenu,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="group flex w-64 items-center justify-end border border-border bg-card p-2">
        <Story />
      </div>
    ),
  ],
  args: {
    onAddSubtask: fn(),
    onLinkExisting: fn(),
    onMoveUnder: fn(),
    onSetProject: fn(),
    onDelete: fn(),
  },
} satisfies Meta<typeof TreeRowActionsMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'the desktop row actions trigger stays hidden before the row is hovered',
}

export const DesktopMenuOpen: Story = {
  name: 'the desktop row actions menu is open',
  tags: ['desktop-only'],
  args: {
    defaultOpen: 'desktop',
  },
}

export const MobileActionsHidden: Story = {
  name: 'the mobile tree row has no actions menu',
  tags: ['mobile-only'],
}
