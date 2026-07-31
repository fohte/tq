import type { Meta, StoryObj } from '@storybook/react-vite'

import { PanelHeader } from '#components/ui/panel'

const meta = {
  title: 'UI/PanelHeader',
  component: PanelHeader,
  tags: ['autodocs'],
} satisfies Meta<typeof PanelHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: 'OPEN TASKS',
  },
}

export const WithTrailingAction: Story = {
  args: {
    children: null,
  },
  render: () => (
    <PanelHeader>
      OPEN TASKS
      <span className="ml-auto text-[10px] tracking-normal">view board →</span>
    </PanelHeader>
  ),
}
