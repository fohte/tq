import type { Meta, StoryObj } from '@storybook/react-vite'

import { ChecklistItemComposer } from '#components/task/task-checklist-item-composer'

const meta = {
  title: 'Task/Checklists/ItemComposer',
  component: ChecklistItemComposer,
  args: {
    depth: 0,
    onSave: () => {},
    onCancel: () => {},
  },
} satisfies Meta<typeof ChecklistItemComposer>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  name: 'a new checklist item can be entered',
  args: { depth: 0 },
}
