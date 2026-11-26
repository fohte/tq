import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { fn } from 'storybook/test'

import { RecurringTemplateCreateModal } from '#components/recurring/recurring-template-create-modal'
import { resetSessionOpenSettings } from '#hooks/session-open-settings-test-fixtures'
import { labelKeys } from '#lib/query-keys'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
})
queryClient.setQueryData(labelKeys.list({ context: 'work' }), [])
queryClient.setQueryData(labelKeys.list({ context: 'personal' }), [])

const meta = {
  title: 'Recurring/RecurringTemplateCreateModal',
  component: RecurringTemplateCreateModal,
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: [http.get('/api/labels', () => HttpResponse.json([]))],
    },
  },
  decorators: [
    (Story) => {
      resetSessionOpenSettings({ localContext: 'personal' })
      return (
        <QueryClientProvider client={queryClient}>
          <div className="dark h-screen bg-background">
            <Story />
          </div>
        </QueryClientProvider>
      )
    },
  ],
  args: {
    open: true,
    onOpenChange: fn(),
    today: '2026-03-20',
  },
} satisfies Meta<typeof RecurringTemplateCreateModal>

export default meta
type Story = StoryObj<typeof meta>

export const Create: Story = {
  name: 'the form is ready to create a recurring template',
}
