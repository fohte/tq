import type { Meta, StoryObj } from '@storybook/react-vite'
import { Kanban, List, Pencil, Trash2 } from 'lucide-react'
import { expect, fn, within } from 'storybook/test'

import { ActionsMenu } from '#components/ui/actions-menu'
import { assertDefined } from '#lib/test-utils'

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

export const Closed: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await expect(body.queryByText('rename…')).not.toBeInTheDocument()
  },
}

// Both triggers exist in the DOM at once (only one is visible per the
// `hidden md:flex` / `flex md:hidden` split, resolved by the real browser
// viewport `web/vitest.config.ts` sets per project) — select each by its
// `data-slot` rather than an ambiguous accessible-name query.
export const DesktopMenuOpen: Story = {
  play: async ({ canvasElement, userEvent }) => {
    const trigger = assertDefined(
      canvasElement.querySelector<HTMLElement>(
        '[data-slot="dropdown-menu-trigger"]',
      ),
      'desktop trigger not found',
    )
    await userEvent.click(trigger)

    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByText('rename…')).toBeInTheDocument()
    await expect(body.getByText('delete…')).toBeInTheDocument()
  },
}

export const MobileActionSheetOpen: Story = {
  play: async ({ canvasElement, userEvent }) => {
    const trigger = assertDefined(
      canvasElement.querySelector<HTMLElement>(
        '[data-slot="action-sheet-trigger"]',
      ),
      'mobile trigger not found',
    )
    await userEvent.click(trigger)

    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByText('rename…')).toBeInTheDocument()
    await expect(body.getByText('delete…')).toBeInTheDocument()
  },
}

// The active option gets a trailing checkmark svg alongside its own icon —
// two svgs on the selected row, one on the others.
export const SelectedItem: Story = {
  args: {
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
  play: async ({ canvasElement, userEvent }) => {
    const trigger = assertDefined(
      canvasElement.querySelector<HTMLElement>(
        '[data-slot="dropdown-menu-trigger"]',
      ),
      'desktop trigger not found',
    )
    await userEvent.click(trigger)

    const body = within(canvasElement.ownerDocument.body)
    const listItem = assertDefined(
      (await body.findByText('List')).closest(
        '[data-slot="dropdown-menu-item"]',
      ),
      'List item not found',
    )
    const boardItem = assertDefined(
      body.getByText('Board').closest('[data-slot="dropdown-menu-item"]'),
      'Board item not found',
    )
    await expect(listItem.querySelectorAll('svg')).toHaveLength(2)
    await expect(boardItem.querySelectorAll('svg')).toHaveLength(1)
  },
}

// `mobileItems={[]}` (day view uses this to hide the layout picker while the
// mobile calendar pane is active) removes the mobile trigger entirely instead
// of opening onto an empty sheet.
export const MobileItemsHidden: Story = {
  args: {
    mobileItems: [],
  },
  play: async ({ canvasElement }) => {
    await expect(
      canvasElement.querySelector('[data-slot="action-sheet-trigger"]'),
    ).not.toBeInTheDocument()
    await expect(
      canvasElement.querySelector('[data-slot="dropdown-menu-trigger"]'),
    ).toBeInTheDocument()
  },
}
