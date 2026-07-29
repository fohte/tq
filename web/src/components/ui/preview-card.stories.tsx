import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import {
  PreviewCard,
  PreviewCardPopup,
  PreviewCardPortal,
  PreviewCardPositioner,
  PreviewCardTrigger,
} from '#components/ui/preview-card'

function PreviewCardDemo({
  open,
  onOpenChange,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  return (
    <PreviewCard open={open} onOpenChange={onOpenChange}>
      <PreviewCardTrigger
        render={<span />}
        className="cursor-default rounded border border-border px-2 py-0.5 text-sm"
      >
        Hover me
      </PreviewCardTrigger>
      <PreviewCardPortal>
        <PreviewCardPositioner>
          <PreviewCardPopup>Preview card content</PreviewCardPopup>
        </PreviewCardPositioner>
      </PreviewCardPortal>
    </PreviewCard>
  )
}

const meta = {
  title: 'UI/PreviewCard',
  component: PreviewCardDemo,
  parameters: {
    layout: 'centered',
  },
  args: {
    onOpenChange: fn(),
  },
} satisfies Meta<typeof PreviewCardDemo>

export default meta
type Story = StoryObj<typeof meta>

export const Closed: Story = {
  args: {
    open: false,
  },
}

export const Open: Story = {
  args: {
    open: true,
  },
}
