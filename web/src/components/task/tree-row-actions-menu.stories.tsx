import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'

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
  },
} satisfies Meta<typeof TreeRowActionsMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await expect(body.queryByText('add subtask')).not.toBeInTheDocument()
  },
}

// Both triggers exist in the DOM at once (only one is visible per the
// `hidden md:flex` / `flex md:hidden` split, resolved by the real browser
// viewport `web/vitest.config.ts` sets per project) — select each by its
// `data-slot` rather than an ambiguous accessible-name query.
export const DesktopMenuOpen: Story = {
  play: async ({ canvasElement, userEvent }) => {
    const trigger = canvasElement.querySelector<HTMLElement>(
      '[data-slot="dropdown-menu-trigger"]',
    )
    if (trigger == null) throw new Error('desktop trigger not found')
    await userEvent.click(trigger)

    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByText('add subtask')).toBeInTheDocument()
    await expect(body.getByText('link existing task…')).toBeInTheDocument()
    await expect(body.getByText('move under…')).toBeInTheDocument()
    await expect(body.getByText('set project…')).toBeInTheDocument()
  },
}

export const MobileActionSheetOpen: Story = {
  play: async ({ canvasElement, userEvent }) => {
    const trigger = canvasElement.querySelector<HTMLElement>(
      '[data-slot="action-sheet-trigger"]',
    )
    if (trigger == null) throw new Error('mobile trigger not found')
    await userEvent.click(trigger)

    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByText('add subtask')).toBeInTheDocument()
    await expect(body.getByText('link existing task…')).toBeInTheDocument()
    await expect(body.getByText('move under…')).toBeInTheDocument()
    await expect(body.getByText('set project…')).toBeInTheDocument()
  },
}
