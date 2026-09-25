import type { Meta, StoryObj } from '@storybook/react-vite'

import { makeNode } from '#components/task/task-row-test-fixtures'
import { TreeDragOverlayContent } from '#components/task/tree-drag-overlay-content'

const node = makeNode({
  id: 'dragged-1',
  number: 12,
  title: 'Write API documentation',
})

const targetNode = makeNode({
  id: 'target-1',
  number: 34,
  title: 'Parent task',
})

const meta = {
  title: 'Task/TreeDragOverlayContent',
  component: TreeDragOverlayContent,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TreeDragOverlayContent>

export default meta
type Story = StoryObj<typeof meta>

export const NoTarget: Story = {
  name: 'the dragged task follows the pointer before a target is chosen',
  args: {
    node,
    target: null,
  },
}

export const ChildTarget: Story = {
  name: 'dropping the task on a parent creates a child',
  args: {
    node,
    target: { node: targetNode, depth: 0, mode: 'child' },
  },
}

export const SiblingTarget: Story = {
  name: 'dropping the task beside a row creates a sibling',
  args: {
    node,
    target: { node: targetNode, depth: 0, mode: 'sibling' },
  },
}
