import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { Button } from '#components/ui/button'
import { Kbd } from '#components/ui/kbd'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '#components/ui/tooltip'

function TooltipDemo({
  open,
  onOpenChange,
  content,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  content?: React.ReactNode
}) {
  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={onOpenChange}>
        <TooltipTrigger render={<Button />}>Hover me</TooltipTrigger>
        <TooltipContent>{content ?? 'Add to library'}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

const meta = {
  title: 'UI/Tooltip',
  component: TooltipDemo,
  parameters: {
    layout: 'centered',
  },
  args: {
    onOpenChange: fn(),
  },
} satisfies Meta<typeof TooltipDemo>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    open: false,
  },
}

export const Open: Story = {
  args: {
    open: true,
  },
}

export const WithKbd: Story = {
  args: {
    open: true,
    content: (
      <>
        Add to library
        <Kbd>⌘S</Kbd>
      </>
    ),
  },
}
