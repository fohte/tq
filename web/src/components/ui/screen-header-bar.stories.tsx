import type { Meta, StoryObj } from '@storybook/react-vite'

import { ScreenHeaderBar } from '#components/ui/screen-header-bar'

const meta = {
  title: 'UI/ScreenHeaderBar',
  component: ScreenHeaderBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ScreenHeaderBar>

export default meta
type Story = StoryObj<typeof meta>

export const WithLabelAndAction: Story = {
  args: {
    children: null,
  },
  render: () => (
    <div className="w-96 border border-border">
      <ScreenHeaderBar>
        <span className="font-mono text-xs font-bold text-primary">##</span>
        <span className="font-mono text-xs font-medium">queue</span>
        <button
          type="button"
          className="ml-auto font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          + new
        </button>
      </ScreenHeaderBar>
    </div>
  ),
}

export const WithScreenTitle: Story = {
  args: {
    children: null,
  },
  render: () => (
    <div className="w-96 border border-border">
      <ScreenHeaderBar>
        <span className="font-mono text-xs font-bold">tasks</span>
      </ScreenHeaderBar>
    </div>
  ),
}
