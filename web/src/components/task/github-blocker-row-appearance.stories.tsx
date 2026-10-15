import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { GithubBlockerRowAppearance } from '#components/task/github-blocker-row-appearance'
import { makeGithubBlocker } from '#components/task/github-link-test-fixtures'

const meta = {
  title: 'Task/GithubBlockerRowAppearance',
  component: GithubBlockerRowAppearance,
  args: {
    onWaitModeChange: fn(),
    onNotifyEventsChange: fn(),
    onRemove: fn(),
  },
} satisfies Meta<typeof GithubBlockerRowAppearance>

export default meta
type Story = StoryObj<typeof meta>

export const UntilClosed: Story = {
  name: 'the GitHub blocker waits until it is closed',
  args: {
    blocker: makeGithubBlocker(),
    waitMode: 'until-closed',
  },
}

export const UntilReply: Story = {
  name: 'the GitHub blocker waits for a reply',
  args: {
    blocker: makeGithubBlocker(),
    waitMode: 'until-reply',
  },
}
