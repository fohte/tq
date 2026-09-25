import type { Meta, StoryObj } from '@storybook/react-vite'
import { X } from 'lucide-react'

import { Button } from '#components/ui/button'
import { DesktopModalFrame } from '#components/ui/desktop-modal-frame'
import { DialogHeaderBar } from '#components/ui/dialog'

const meta = {
  title: 'UI/DesktopModalFrame',
  component: DesktopModalFrame,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['desktop-only'],
} satisfies Meta<typeof DesktopModalFrame>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: null,
  },
  render: () => (
    <div className="dark min-h-screen bg-background">
      <div className="fixed inset-0 bg-black/40" />
      <DesktopModalFrame>
        <DialogHeaderBar>
          <span className="text-base font-semibold text-foreground">
            Create item
          </span>
          <Button type="button" variant="ghost" size="icon">
            <X className="size-5" />
            <span className="sr-only">Close</span>
          </Button>
        </DialogHeaderBar>
        <div className="flex-1 overflow-y-auto p-6 text-sm text-muted-foreground">
          Modal content goes here.
        </div>
      </DesktopModalFrame>
    </div>
  ),
}
