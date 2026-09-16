import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { DeleteRecurringTemplateDialog } from '#components/recurring/delete-recurring-template-dialog'

const meta = {
  title: 'Recurring/DeleteRecurringTemplateDialog',
  component: DeleteRecurringTemplateDialog,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false, staleTime: Infinity } },
          })
        }
      >
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: {
    open: true,
    onOpenChange: () => {},
    templateId: '00000000-0000-0000-0000-000000000001',
    templateTitle: 'Write weekly report',
  },
} satisfies Meta<typeof DeleteRecurringTemplateDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const LongTitle: Story = {
  args: {
    templateTitle:
      'Send a weekly summary of ISUCON14 practice benchmark progress to the team channel',
  },
}
