import type { Meta, StoryObj } from '@storybook/react-vite'

import { HelpPopover } from '#components/ui/help-popover'

const meta = {
  title: 'UI/HelpPopover',
  component: HelpPopover,
  args: {
    label: 'Show example help',
    children: (
      <div className="w-64 p-3 font-sans text-sm text-popover-foreground">
        Short help content appears here.
      </div>
    ),
  },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof HelpPopover>

export default meta
type Story = StoryObj<typeof meta>

export const Closed: Story = {
  name: 'shows the help button without its popover',
}

export const Open: Story = {
  name: 'shows example guidance in the help popover',
  args: { defaultOpen: true },
}
