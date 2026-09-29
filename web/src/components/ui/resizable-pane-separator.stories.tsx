import type { Meta, StoryObj } from '@storybook/react-vite'

import { ResizablePaneSeparator } from '#components/ui/resizable-pane-separator'

const meta = {
  title: 'UI/Resizable Pane Separator',
  component: ResizablePaneSeparator,
  tags: ['autodocs'],
} satisfies Meta<typeof ResizablePaneSeparator>

export default meta
type Story = StoryObj<typeof meta>

export const BetweenPanes: Story = {
  name: 'the divider separates navigation and content panes',
  args: {
    label: 'Resize navigation pane',
    value: 256,
    min: 160,
    max: 400,
    onValueChange: () => {},
  },
  render: (args) => (
    <div className="flex h-64 w-full overflow-hidden rounded border border-border text-sm">
      <section className="flex w-64 shrink-0 items-center justify-center bg-sidebar text-muted-foreground">
        Navigation pane
      </section>
      <div className="relative w-0 shrink-0 md:w-2">
        <ResizablePaneSeparator {...args} />
      </div>
      <section className="flex min-w-0 flex-1 items-center justify-center bg-card text-muted-foreground">
        Content pane
      </section>
    </div>
  ),
}
