import type { Meta, StoryObj } from '@storybook/react-vite'
import { XIcon } from 'lucide-react'
import { fn } from 'storybook/test'

import { Button } from '#components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogHeaderBar,
  DialogTitle,
  DialogTrigger,
} from '#components/ui/dialog'

function DialogDemo({
  open,
  onOpenChange,
  showCloseButton = true,
  showFooter = true,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  showCloseButton?: boolean
  showFooter?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button />}>Open dialog</DialogTrigger>
      <DialogContent showCloseButton={showCloseButton}>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Make changes to your profile here. Click save when done.
          </DialogDescription>
        </DialogHeader>
        {showFooter && (
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button>Save changes</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

const meta = {
  title: 'UI/Dialog',
  component: DialogDemo,
  parameters: {
    layout: 'centered',
  },
  args: {
    onOpenChange: fn(),
  },
} satisfies Meta<typeof DialogDemo>

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

export const WithoutFooter: Story = {
  args: {
    open: true,
    showFooter: false,
  },
}

export const WithoutCloseButton: Story = {
  args: {
    open: true,
    showCloseButton: false,
  },
}

export const HeaderBar: Story = {
  render: () => (
    <DialogHeaderBar>
      <span className="text-base font-semibold text-foreground">New Task</span>
      <Button type="button" variant="ghost" size="icon">
        <XIcon className="size-5" />
        <span className="sr-only">Close</span>
      </Button>
    </DialogHeaderBar>
  ),
}
