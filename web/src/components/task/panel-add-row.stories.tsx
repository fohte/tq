import type { Meta, StoryObj } from '@storybook/react-vite'
import { Plus } from 'lucide-react'
import { fn } from 'storybook/test'

import { PanelAddRow } from '#components/task/panel-add-row'
import { ActionsMenu } from '#components/ui/actions-menu'

const meta = {
  title: 'Task/PanelAddRow',
  component: PanelAddRow,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div className="border border-border bg-card">
        <Story />
      </div>
    ),
  ],
  args: {
    icon: Plus,
    label: 'add item',
    onClick: fn(),
  },
} satisfies Meta<typeof PanelAddRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'the panel offers an add action',
}

export const Disabled: Story = {
  name: 'the panel disables the add action',
  args: { disabled: true },
}

export const WithTrailingMenu: Story = {
  name: 'the add action shares its row with a trailing menu',
  args: {
    trailing: (
      <ActionsMenu
        aria-label="Checklist actions"
        items={[{ icon: <Plus />, label: 'edit', onClick: fn() }]}
        mobileTriggerLayout="compact-row"
      />
    ),
  },
}
