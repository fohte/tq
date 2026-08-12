import type { Meta, StoryObj } from '@storybook/react-vite'
import { X } from 'lucide-react'

import { Button } from '#components/ui/button'
import { DialogHeaderBar } from '#components/ui/dialog'
import { ModalPanel } from '#components/ui/modal-panel'

const meta = {
  title: 'UI/ModalPanel',
  component: ModalPanel,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ModalPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: null,
  },
  render: () => (
    <div className="flex h-96 items-center justify-center bg-black/40 p-8">
      <ModalPanel>
        <DialogHeaderBar>
          <span className="text-base font-semibold text-foreground">
            New Task
          </span>
          <Button type="button" variant="ghost" size="icon">
            <X className="size-5" />
            <span className="sr-only">Close</span>
          </Button>
        </DialogHeaderBar>
        <div className="flex-1 overflow-y-auto p-6 text-sm text-muted-foreground">
          Modal content goes here.
        </div>
      </ModalPanel>
    </div>
  ),
}
