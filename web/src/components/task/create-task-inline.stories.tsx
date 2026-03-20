import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  CreateTaskInline,
  FloatingActionButton,
} from '@web/components/task/create-task-inline'
import { fn } from 'storybook/test'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const meta = {
  title: 'Task/CreateTaskInline',
  component: CreateTaskInline,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="w-80">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  args: {
    onClose: fn(),
  },
} satisfies Meta<typeof CreateTaskInline>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const FAB: StoryObj<typeof FloatingActionButton> = {
  render: () => (
    <div className="relative h-40 w-40">
      <FloatingActionButton onClick={fn()} />
    </div>
  ),
}
