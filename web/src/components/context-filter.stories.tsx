import type { Meta, StoryObj } from '@storybook/react-vite'

import { ContextFilter, ContextFilterInline } from '#components/context-filter'

function ContextFilterDemo() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          Sidebar variant
        </p>
        <div className="w-md border border-border bg-sidebar p-2.5">
          <ContextFilter />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          Inline variant
        </p>
        <ContextFilterInline />
      </div>
    </div>
  )
}

const meta = {
  title: 'UI/ContextFilter',
  component: ContextFilterDemo,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof ContextFilterDemo>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Sidebar: Story = {
  render: () => (
    <div className="w-md border border-border bg-sidebar p-2.5">
      <ContextFilter />
    </div>
  ),
}

export const Inline: Story = {
  render: () => (
    <div className="p-4">
      <ContextFilterInline />
    </div>
  ),
}
