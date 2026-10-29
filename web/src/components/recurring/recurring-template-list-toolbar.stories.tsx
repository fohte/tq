import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { RecurringTemplateListToolbar } from '#components/recurring/recurring-template-list-toolbar'

const meta = {
  title: 'Recurring/RecurringTemplateListToolbar',
  component: RecurringTemplateListToolbar,
  decorators: [
    (Story) => (
      <div className="dark bg-background">
        <Story />
      </div>
    ),
  ],
  args: {
    onCreate: fn(),
  },
} satisfies Meta<typeof RecurringTemplateListToolbar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'the recurring list toolbar offers template creation',
}
