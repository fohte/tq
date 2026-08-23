import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'

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
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open filter' }))

    const body = within(canvasElement.ownerDocument.body)
    await expect(
      await body.findByText('Filter options go here.'),
    ).toBeInTheDocument()
  },
}
