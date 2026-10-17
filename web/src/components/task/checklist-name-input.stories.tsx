import type { Meta, StoryObj } from '@storybook/react-vite'

import { ChecklistNameInput } from '#components/task/checklist-name-input'

const meta = {
  title: 'Task/Checklists/ChecklistNameInput',
  component: ChecklistNameInput,
  args: {
    value: 'Camping gear',
    onChange: () => {},
    onBlur: () => {},
    onKeyDown: () => {},
  },
  render: (args) => (
    <div className="flex min-h-9 items-center gap-2 border-b border-border bg-card px-3 py-1.5">
      <ChecklistNameInput {...args} />
    </div>
  ),
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ChecklistNameInput>

export default meta
type Story = StoryObj<typeof meta>

export const Editing: Story = {
  name: 'a checklist name is being edited',
}
