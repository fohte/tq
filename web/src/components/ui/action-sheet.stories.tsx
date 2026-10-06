import { Button } from '@fohte/ui/button'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { CornerUpLeft, Plus, Search, Trash2 } from 'lucide-react'
import { fn } from 'storybook/test'

import {
  ActionSheet,
  ActionSheetContent,
  ActionSheetItem,
  ActionSheetTrigger,
} from '#components/ui/action-sheet'

function ActionSheetDemo({
  open,
  onOpenChange,
  showDestructiveAction = false,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  showDestructiveAction?: boolean
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
        {showDestructiveAction && (
          <ActionSheetItem
            icon={<Trash2 className="h-4 w-4" />}
            variant="destructive"
          >
            delete task…
          </ActionSheetItem>
        )}
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
  name: 'shows the actions button before opening the sheet',
  args: {
    open: false,
  },
}

export const Open: Story = {
  name: 'shows task actions in an open mobile sheet',
  args: {
    open: true,
  },
}

export const DestructiveItem: Story = {
  name: 'the open sheet marks the delete action as destructive',
  args: {
    open: true,
    showDestructiveAction: true,
  },
}
