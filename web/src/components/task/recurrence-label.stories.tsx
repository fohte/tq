import type { Meta, StoryObj } from '@storybook/react-vite'

import { makeRecurringTemplate } from '#components/recurring/recurring-template-test-fixtures'
import { RecurrenceLabel } from '#components/task/task-row-shared'

const template = makeRecurringTemplate()

const meta = {
  title: 'Task/RecurrenceLabel',
  component: RecurrenceLabel,
  args: {
    rule: template.recurrenceRule,
    templateId: template.id,
  },
} satisfies Meta<typeof RecurrenceLabel>

export default meta
type Story = StoryObj<typeof meta>

export const LinkedTemplate: Story = {
  name: 'the task row links to its recurring template',
}
