import type { Meta, StoryObj } from '@storybook/react-vite'
import { X } from 'lucide-react'

import {
  BottomSheetHeader,
  BottomSheetPanel,
} from '#components/ui/bottom-sheet'
import { Button } from '#components/ui/button'

const meta = {
  title: 'UI/BottomSheetPanel',
  component: BottomSheetPanel,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof BottomSheetPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: null,
  },
  render: () => (
    <div className="flex h-96 items-end bg-black/40">
      <BottomSheetPanel>
        <BottomSheetHeader>
          <span className="text-base font-semibold text-foreground">
            New Task
          </span>
          <Button type="button" variant="ghost" size="icon">
            <X className="size-5" />
            <span className="sr-only">Close</span>
          </Button>
        </BottomSheetHeader>
        <div className="px-5 pt-4 text-sm text-muted-foreground">
          Sheet content goes here.
        </div>
      </BottomSheetPanel>
    </div>
  ),
}
