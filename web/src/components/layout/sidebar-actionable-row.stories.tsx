import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { SidebarActionableRow } from '#components/layout/sidebar-row'
import { StoryRouter } from '#storybook-config/story-router'

function SidebarActionableRowStory(
  props: React.ComponentProps<typeof SidebarActionableRow>,
) {
  return (
    <StoryRouter
      component={() => <SidebarActionableRow {...props} />}
      paths={['/tasks']}
    />
  )
}

const meta = {
  title: 'Layout/SidebarActionableRow',
  component: SidebarActionableRowStory,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="w-50 border border-border bg-sidebar">
        <Story />
      </div>
    ),
  ],
  args: {
    search: { q: 'commitment:active' },
    isActive: false,
    actionsAriaLabel: 'View actions',
    editItemLabel: 'rename…',
    onEdit: fn(),
    deleteTitle: 'Delete view',
    deleteDescription:
      'Are you sure you want to delete "Now"? This action cannot be undone.',
    onDelete: fn(),
    children: <span className="flex-1 truncate text-left">Now</span>,
  },
} satisfies Meta<typeof SidebarActionableRowStory>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ActionsMenuOpen: Story = {
  tags: ['desktop-only'],
  args: {
    defaultOpen: 'desktop',
  },
}
