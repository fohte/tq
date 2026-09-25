import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { DeleteTaskDialog } from '#components/task/delete-task-dialog'

const meta = {
  title: 'Task/DeleteTaskDialog',
  component: DeleteTaskDialog,
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
    taskId: '00000000-0000-0000-0000-000000000001',
    taskNumber: 42,
    taskTitle: 'Fix the login redirect',
    taskHasParent: false,
  },
} satisfies Meta<typeof DeleteTaskDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'asks to delete the selected task',
}

export const WithParent: Story = {
  name: 'keeps subtasks under the parent after deletion',
  args: {
    taskHasParent: true,
  },
}

export const LongTitle: Story = {
  name: 'shows a long task title in the confirmation dialog',
  args: {
    taskTitle:
      'Rework the scheduling heuristics so recurring tasks land on the right day',
  },
}
