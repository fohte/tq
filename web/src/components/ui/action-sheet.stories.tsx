import type { Meta, StoryObj } from '@storybook/react-vite'
import { CornerUpLeft, Plus, Search } from 'lucide-react'
import { fn } from 'storybook/test'

import {
  ActionSheet,
  ActionSheetContent,
  ActionSheetItem,
  ActionSheetTrigger,
} from '#components/ui/action-sheet'
import { Button } from '#components/ui/button'

function ActionSheetDemo({
  open,
  onOpenChange,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  return (
    <ActionSheet open={open} onOpenChange={onOpenChange}>
      <ActionSheetTrigger render={<Button />}>Actions</ActionSheetTrigger>
      <ActionSheetContent>
        <ActionSheetItem icon={<Plus className="h-4 w-4" />}>
          add subtask
        </ActionSheetItem>
        <ActionSheetItem icon={<Search className="h-4 w-4" />}>
          link existing task…
        </ActionSheetItem>
        <ActionSheetItem icon={<CornerUpLeft className="h-4 w-4" />}>
          move under…
        </ActionSheetItem>
      </ActionSheetContent>
    </ActionSheet>
  )
}

const meta = {
  title: 'UI/ActionSheet',
  component: ActionSheetDemo,
  parameters: {
    layout: 'centered',
  },
  args: {
    onOpenChange: fn(),
  },
} satisfies Meta<typeof ActionSheetDemo>

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
