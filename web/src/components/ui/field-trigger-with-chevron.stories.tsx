import type { Meta, StoryObj } from '@storybook/react-vite'

import { FieldTriggerWithChevron } from '#components/ui/field-trigger-with-chevron'

const meta = {
  component: FieldTriggerWithChevron,
  args: { children: 'Example value' },
  decorators: [
    (Story) => (
      <div className="w-48 p-2 font-mono text-xs">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FieldTriggerWithChevron>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'a field trigger shows a value with a chevron.',
}

export const LongValue: Story = {
  name: 'a field trigger truncates a long value before the chevron.',
  args: {
    children: 'A field with a title that is longer than its available width',
  },
}
