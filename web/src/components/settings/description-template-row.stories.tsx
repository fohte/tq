import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ComponentProps } from 'react'
import { fn } from 'storybook/test'

import { DescriptionTemplateRow } from '#components/settings/description-template-row'
import { makeDescriptionTemplate } from '#components/settings/description-template-test-fixtures'

function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function WrappedDescriptionTemplateRow(
  props: ComponentProps<typeof DescriptionTemplateRow>,
) {
  return (
    <Providers>
      <div className="w-full max-w-3xl">
        <DescriptionTemplateRow {...props} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Settings/DescriptionTemplateRow',
  component: WrappedDescriptionTemplateRow,
  parameters: {
    layout: 'centered',
  },
  args: {
    onEdit: fn(),
  },
} satisfies Meta<typeof WrappedDescriptionTemplateRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'a default template shows its name and markdown headings',
  args: {
    template: makeDescriptionTemplate({
      id: 'template-id-1',
      name: 'Sample template',
      body: '## Goal\n\n## Outcome',
      isDefault: true,
    }),
  },
}

export const NonDefault: Story = {
  name: 'a non-default template has no default marker',
  args: {
    template: makeDescriptionTemplate({
      id: 'template-id-2',
      name: 'Review template',
      body: '## Scope\n\n## Findings',
      isDefault: false,
    }),
  },
}
