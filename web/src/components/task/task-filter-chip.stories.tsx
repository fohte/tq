import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'

import { TaskFilterChip } from '#components/task/task-filter-chip'

const meta = {
  title: 'Task/TaskFilterChip',
  component: TaskFilterChip,
  args: {
    attribute: 'is',
    value: 'todo, doing',
    menuTitle: 'Status',
    children: <div className="text-sm text-foreground">menu content</div>,
  },
} satisfies Meta<typeof TaskFilterChip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const LabelChip: Story = {
  args: {
    attribute: 'label',
    value: '#infra',
    menuTitle: 'Label',
  },
}

// FilterMenu's desktop branch is a plain AnchoredPopup, so opening it is
// enough to verify the chip is genuinely pressable and forwards its
// children into the popup.
export const OpenMenu: Story = {
  tags: ['desktop-only'],
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'is todo, doing' }),
    )

    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByText('menu content')).toBeVisible()
  },
}
