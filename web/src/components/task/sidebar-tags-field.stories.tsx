import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { SidebarTagsField } from '#components/task/sidebar-tags-field'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})

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
