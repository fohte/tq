import type { Meta, StoryObj } from '@storybook/react-vite'

import { SidebarField } from '#components/task/sidebar-field'

const meta = {
  title: 'Task/SidebarField',
  component: SidebarField,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="dark w-48 bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SidebarField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'the field shows an estimate label with a formatted duration.',
  args: {
    label: 'ESTIMATE',
    children: '1h30m',
  },
}
