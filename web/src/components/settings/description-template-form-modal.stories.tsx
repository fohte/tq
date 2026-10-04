import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fn } from 'storybook/test'

import { DescriptionTemplateFormModal } from '#components/settings/description-template-form-modal'
import { makeDescriptionTemplate } from '#components/settings/description-template-test-fixtures'

function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const meta = {
  title: 'Settings/DescriptionTemplateFormModal',
  component: DescriptionTemplateFormModal,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <Providers>
        <div className="dark h-screen bg-background">
          <Story />
        </div>
      </Providers>
    ),
  ],
  args: {
    open: true,
    onOpenChange: fn(),
  },
} satisfies Meta<typeof DescriptionTemplateFormModal>

export default meta
type Story = StoryObj<typeof meta>

export const Create: Story = {
  name: 'the form is ready to create a description template',
}

export const Edit: Story = {
  name: 'the form is populated with an existing description template',
  args: {
    template: makeDescriptionTemplate({
      id: 'template-id-1',
      name: 'Sample template',
      whenToUse: 'Use when work has a clear outcome.',
      body: '## Goal\n\n## Outcome',
      guide: 'Describe the goal and the expected outcome.',
      isDefault: true,
    }),
  },
}
