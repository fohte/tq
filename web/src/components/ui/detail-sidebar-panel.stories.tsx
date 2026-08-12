import type { Meta, StoryObj } from '@storybook/react-vite'

import { DetailSidebarPanel } from '#components/ui/detail-sidebar-panel'

const meta = {
  title: 'UI/DetailSidebarPanel',
  component: DetailSidebarPanel,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof DetailSidebarPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div className="flex h-64">
      <DetailSidebarPanel>
        <span className="font-mono text-2xs tracking-widest text-muted-foreground-faint">
          DETAILS
        </span>
        <span className="text-sm text-foreground">
          Sidebar content goes here.
        </span>
      </DetailSidebarPanel>
    </div>
  ),
}
