import type { Meta, StoryObj } from '@storybook/react-vite'

import { Panel } from '#components/ui/panel'

const meta = {
  title: 'UI/Panel',
  component: Panel,
  tags: ['autodocs'],
} satisfies Meta<typeof Panel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: null,
  },
  render: () => (
    <Panel>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-sm last:border-b-0">
        Add integration tests
      </div>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-sm last:border-b-0">
        Review PR #42
      </div>
    </Panel>
  ),
}
