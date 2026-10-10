import type { Meta, StoryObj } from '@storybook/react-vite'

import { TaskWaitMutationError } from '#components/task/task-wait-mutation-error'

const meta = {
  title: 'Task/TaskWaitMutationError',
  component: TaskWaitMutationError,
  args: {
    message: 'Unable to resolve this wait. Please try again.',
  },
} satisfies Meta<typeof TaskWaitMutationError>

export default meta
type Story = StoryObj<typeof meta>

export const ResolveFailure: Story = {
  name: 'the task explains when resolving a wait fails',
}
