import type { Meta, StoryObj } from '@storybook/react-vite'
import { useRef } from 'react'
import { fn } from 'storybook/test'

import { AnchoredPopup } from '#components/ui/anchored-popup'

function AnchoredPopupDemo({
  open,
  onOpenChange,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const anchorRef = useRef<HTMLButtonElement>(null)

  return (
    <div>
      <button
        ref={anchorRef}
        type="button"
        className="rounded-md border border-input px-3 py-1.5 text-sm"
      >
        Select task
      </button>
      <AnchoredPopup open={open} onOpenChange={onOpenChange} anchor={anchorRef}>
        <div className="px-2 py-1 text-sm">#1 Fix login redirect bug</div>
        <div className="px-2 py-1 text-sm">#2 Add dark mode toggle</div>
        <div className="px-2 py-1 text-sm">#3 Update dependency versions</div>
      </AnchoredPopup>
    </div>
  )
}

function AnchoredPopupWithInputDemo({
  open,
  onOpenChange,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const anchorRef = useRef<HTMLInputElement>(null)

  return (
    <div className="w-48">
      <input
        ref={anchorRef}
        type="text"
        defaultValue="task"
        className="w-full rounded-md border border-input px-2 py-1 text-sm"
      />
      <AnchoredPopup open={open} onOpenChange={onOpenChange} anchor={anchorRef}>
        <div className="px-2 py-1 text-sm">#1 Fix login redirect bug</div>
        <div className="px-2 py-1 text-sm">#2 Add dark mode toggle</div>
      </AnchoredPopup>
    </div>
  )
}

const meta = {
  title: 'UI/AnchoredPopup',
  component: AnchoredPopupDemo,
  parameters: {
    layout: 'centered',
  },
  args: {
    onOpenChange: fn(),
  },
} satisfies Meta<typeof AnchoredPopupDemo>

export default meta
type Story = StoryObj<typeof meta>

export const ClosedTrigger: Story = {
  args: {
    open: false,
  },
}

export const Open: Story = {
  args: {
    open: true,
  },
}

export const InputAnchorOpen: StoryObj<typeof AnchoredPopupWithInputDemo> = {
  render: (args) => <AnchoredPopupWithInputDemo {...args} />,
  args: {
    open: true,
    onOpenChange: fn(),
  },
}
