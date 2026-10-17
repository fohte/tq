import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { makeGithubBlocker } from '#components/task/github-link-test-fixtures'
import { GithubWaitModeSelect } from '#components/task/github-wait-mode-select'

const blocker = makeGithubBlocker()

const meta = {
  title: 'Task/GithubWaitModeSelect',
  component: GithubWaitModeSelect,
  args: {
    blocker,
    onChange: fn(),
  },
} satisfies Meta<typeof GithubWaitModeSelect>

export default meta
type Story = StoryObj<typeof meta>

export const UntilClosed: Story = {
  name: 'the open GitHub blocker waits until it is closed',
  args: { value: 'until-closed', disabled: false },
}

export const UntilReply: Story = {
  name: 'the open GitHub blocker waits for a reply',
  args: { value: 'until-reply', disabled: false },
}
