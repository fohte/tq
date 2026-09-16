import type { Meta, StoryObj } from '@storybook/react-vite'
import { Kanban, List, Pencil, Trash2 } from 'lucide-react'
import { fn } from 'storybook/test'

import { ActionsMenu } from '#components/ui/actions-menu'

const meta = {
  title: 'UI/ActionsMenu',
  component: ActionsMenu,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="flex w-64 items-center justify-end border border-border bg-card p-2">
        <Story />
      </div>
    ),
  ],
  args: {
    items: [
      { icon: <Pencil className="h-4 w-4" />, label: 'rename…', onClick: fn() },
      {
        icon: <Trash2 className="h-4 w-4" />,
        label: 'delete…',
        onClick: fn(),
        destructive: true,
      },
    ],
  },
} satisfies Meta<typeof ActionsMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Closed: Story = {}

export const DesktopMenuOpen: Story = {
  tags: ['desktop-only'],
  args: {
    defaultOpen: 'desktop',
  },
}

export const MobileActionSheetOpen: Story = {
  tags: ['mobile-only'],
  args: {
    defaultOpen: 'mobile',
  },
}

// The active option gets a trailing checkmark svg alongside its own icon —
// two svgs on the selected row, one on the others.
export const SelectedItem: Story = {
  tags: ['desktop-only'],
  args: {
    defaultOpen: 'desktop',
    items: [
      {
        icon: <List className="h-4 w-4" />,
        label: 'List',
        onClick: fn(),
        selected: true,
      },
      {
        icon: <Kanban className="h-4 w-4" />,
        label: 'Board',
        onClick: fn(),
        selected: false,
      },
    ],
  },
}

// `mobileItems={[]}` (day view uses this to hide the layout picker while the
// mobile calendar pane is active) removes the mobile trigger entirely instead
// of opening onto an empty sheet.
export const MobileItemsHidden: Story = {
  tags: ['mobile-only'],
  args: {
    mobileItems: [],
  },
}
