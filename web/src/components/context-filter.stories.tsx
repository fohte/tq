import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  ContextFilter,
  ContextFilterInline,
} from '@web/components/context-filter'
import { ContextFilterProvider } from '@web/hooks/use-context-filter'
import type { ReactNode } from 'react'

function Providers({ children }: { children: ReactNode }) {
  return <ContextFilterProvider>{children}</ContextFilterProvider>
}

function ContextFilterDemo() {
  return (
    <Providers>
      <div className="flex flex-col gap-8">
        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            Sidebar variant
          </p>
          <div className="flex w-14 flex-col items-center rounded-lg bg-sidebar p-4">
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
    </Providers>
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

function SidebarOnly() {
  return (
    <Providers>
      <div className="flex w-14 flex-col items-center rounded-lg bg-sidebar p-4">
        <ContextFilter />
      </div>
    </Providers>
  )
}

export const Sidebar: Story = {
  render: () => <SidebarOnly />,
}

function InlineOnly() {
  return (
    <Providers>
      <div className="p-4">
        <ContextFilterInline />
      </div>
    </Providers>
  )
}

export const Inline: Story = {
  render: () => <InlineOnly />,
}
