import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CreateTaskModal } from '@web/components/task/create-task-modal'
import { fn } from 'storybook/test'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const meta = {
  title: 'Task/CreateTaskModal',
  component: CreateTaskModal,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="dark h-screen bg-background">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  args: {
    open: true,
    onOpenChange: fn(),
  },
} satisfies Meta<typeof CreateTaskModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithDefaultStartDate: Story = {
  args: {
    defaultStartDate: new Date().toISOString().slice(0, 10),
  },
}
