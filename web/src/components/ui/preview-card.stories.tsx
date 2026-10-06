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
  padding,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  padding?: 'default' | 'none'
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
          <PreviewCardPopup padding={padding ?? 'default'}>
            Preview card content
          </PreviewCardPopup>
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
  name: 'shows the preview trigger without its popup',
  args: {
    open: false,
  },
}

export const Open: Story = {
  name: 'shows preview content beside its trigger',
  args: {
    open: true,
  },
}

export const OpenWithoutPadding: Story = {
  name: 'the preview card shows content flush with its edge',
  args: {
    open: true,
    padding: 'none',
  },
}
