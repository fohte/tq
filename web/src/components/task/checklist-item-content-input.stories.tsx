import type { Meta, StoryObj } from '@storybook/react-vite'

import { ChecklistItemContentInput } from '#components/task/checklist-item-content-input'

const meta = {
  title: 'Task/Checklists/ChecklistItemContentInput',
  component: ChecklistItemContentInput,
  args: {
    itemContent: 'Pack the essentials',
    value: 'Pack the essentials for a weekend trip',
    onChange: () => {},
    onBlur: () => {},
    onKeyDown: () => {},
  },
  render: (args) => (
    <div className="flex min-w-0 items-center gap-2 px-3 py-1">
      <div className="min-w-0 flex-1">
        <ChecklistItemContentInput {...args} />
      </div>
    </div>
  ),
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ChecklistItemContentInput>

export default meta
type Story = StoryObj<typeof meta>

export const Editing: Story = {
  name: 'a checklist item is being edited',
}
