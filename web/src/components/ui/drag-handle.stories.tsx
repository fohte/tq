import { DndContext, useDraggable } from '@dnd-kit/core'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { DragHandle } from '#components/ui/drag-handle'

function DragHandleDemo({ ariaLabel }: { ariaLabel: string }) {
  const { attributes, listeners } = useDraggable({ id: 'drag-handle-demo' })
  return (
    <DragHandle
      attributes={attributes}
      listeners={listeners}
      aria-label={ariaLabel}
    />
  )
}

const meta = {
  title: 'UI/DragHandle',
  component: DragHandleDemo,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <DndContext>
        <Story />
      </DndContext>
    ),
  ],
} satisfies Meta<typeof DragHandleDemo>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    ariaLabel: 'Reorder task',
  },
}
