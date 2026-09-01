import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { SidebarTagsField } from '#components/task/sidebar-tags-field'
import { labelKeys } from '#hooks/use-labels'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: Infinity },
    mutations: { retry: false },
  },
})
// SidebarTagsField's TagsInput always calls useLabels() for suggestions,
// regardless of the labels chips shown via args.
queryClient.setQueryData(labelKeys.list({ context: 'personal' }), [])

const meta = {
  title: 'Task/SidebarTagsField',
  component: SidebarTagsField,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="dark w-48 bg-background p-4">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  args: {
    taskId: '550e8400-e29b-41d4-a716-446655440000',
  },
} satisfies Meta<typeof SidebarTagsField>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: {
    labels: [],
  },
}

export const WithTags: Story = {
  args: {
    labels: ['dev:tq', 'chore'],
  },
}
