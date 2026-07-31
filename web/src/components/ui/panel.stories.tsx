import type { Meta, StoryObj } from '@storybook/react-vite'

import { Panel, PanelHeader } from '#components/ui/panel'

const meta = {
  title: 'UI/Panel',
  component: Panel,
  tags: ['autodocs'],
} satisfies Meta<typeof Panel>

export default meta
type Story = StoryObj<typeof meta>

export const WithHeader: Story = {
  args: {
    children: null,
  },
  render: () => (
    <Panel>
      <PanelHeader>
        OPEN TASKS
        <span className="ml-auto text-[10px] tracking-normal">
          view board →
        </span>
      </PanelHeader>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-sm last:border-b-0">
        Set up CI pipeline
      </div>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-sm last:border-b-0">
        Write onboarding docs
      </div>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-sm last:border-b-0">
        Fix flaky test
      </div>
    </Panel>
  ),
}

export const WithoutHeader: Story = {
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
