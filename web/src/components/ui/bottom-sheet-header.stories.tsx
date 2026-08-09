import type { Meta, StoryObj } from '@storybook/react-vite'
import { X } from 'lucide-react'

import { BottomSheetHeader } from '#components/ui/bottom-sheet'
import { Button } from '#components/ui/button'

const meta = {
  title: 'UI/BottomSheetHeader',
  component: BottomSheetHeader,
} satisfies Meta<typeof BottomSheetHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: null,
  },
  render: () => (
    <BottomSheetHeader>
      <span className="text-base font-semibold text-foreground">New Task</span>
      <Button type="button" variant="ghost" size="icon">
        <X className="size-5" />
        <span className="sr-only">Close</span>
      </Button>
    </BottomSheetHeader>
  ),
}
