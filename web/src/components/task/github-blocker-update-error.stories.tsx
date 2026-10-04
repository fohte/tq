import type { Meta, StoryObj } from '@storybook/react-vite'

import { GithubBlockerUpdateError } from '#components/task/github-blocker-update-error'

const meta = {
  title: 'Task/GithubBlockerUpdateError',
  component: GithubBlockerUpdateError,
  args: {
    message: 'The blocker could not be updated. Please try again.',
  },
} satisfies Meta<typeof GithubBlockerUpdateError>

export default meta
type Story = StoryObj<typeof meta>

export const PatchFailure: Story = {
  name: 'the task shows why a blocker update failed',
}
