import type { Meta, StoryObj } from '@storybook/react-vite'

import { FilterMenu } from '#components/ui/filter-menu'

const meta = {
  title: 'UI/FilterMenu',
  component: FilterMenu,
  parameters: {
    layout: 'centered',
  },
  args: {
    trigger: 'Open filter',
    title: 'Filter',
    children: (
      <div className="text-sm text-foreground">Filter options go here.</div>
    ),
  },
} satisfies Meta<typeof FilterMenu>

export default meta
type Story = StoryObj<typeof meta>

// Desktop renders content in a popover positioned near the trigger.
export const DesktopPopover: Story = {
  tags: ['desktop-only'],
  args: {
    defaultOpen: true,
  },
}

export const MobileSheet: Story = {
  tags: ['mobile-only'],
  args: {
    defaultOpen: true,
  },
}
