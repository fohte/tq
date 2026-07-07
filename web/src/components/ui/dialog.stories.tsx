import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '@web/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@web/components/ui/dialog'
import { fn } from 'storybook/test'

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
