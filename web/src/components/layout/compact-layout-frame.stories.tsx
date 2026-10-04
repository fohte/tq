import type { Meta, StoryObj } from '@storybook/react-vite'

import { CompactLayoutFrame } from '#components/layout/compact-layout-frame'

const meta = {
  title: 'Layout/CompactLayoutFrame',
  component: CompactLayoutFrame,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    children: (
      <div className="flex h-full flex-col bg-background p-3">
        <div className="shrink-0 border-b border-border pb-3">today</div>
        <div className="min-h-0 flex-1 pt-3">calendar</div>
      </div>
    ),
  },
} satisfies Meta<typeof CompactLayoutFrame>

export default meta
type Story = StoryObj<typeof meta>

export const Compact: Story = {
  name: 'the compact frame fills and clips the side window',
}
