import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { GithubBlockerRowAppearance } from '#components/task/github-blocker-row-appearance'
import { makeGithubBlocker } from '#components/task/github-link-test-fixtures'
import { GithubWaitModeSelect } from '#components/task/github-wait-mode-select'
import { TaskWaitEntryAppearance } from '#components/task/task-wait-entry-appearance'
import { makeTaskWait } from '#components/task/task-wait-test-fixtures'

const meta = {
  title: 'Task/GithubBlockerRowAppearance',
  component: GithubBlockerRowAppearance,
  args: {
    onNotifyEventsChange: fn(),
    onRemove: fn(),
  },
} satisfies Meta<typeof GithubBlockerRowAppearance>

export default meta
type Story = StoryObj<typeof meta>

const blocker = makeGithubBlocker()

function waitModeControl(value: 'until-closed' | 'until-reply') {
  return (
    <GithubWaitModeSelect
      blocker={blocker}
      value={value}
      disabled={false}
      onChange={fn()}
    />
  )
}

function replyWaitAppearance(acknowledged = false) {
  return (
    <TaskWaitEntryAppearance
      wait={makeTaskWait({
        label: 'Review feedback',
        body: 'Review received',
        githubLinkId: blocker.id,
        resolvedAt: '2099-10-12T00:00:00.000Z',
        acknowledgedAt: acknowledged ? '2099-10-12T00:00:00.000Z' : null,
      })}
      layout="github-blocker"
      waitModeControl={
        acknowledged ? undefined : waitModeControl('until-reply')
      }
      followUpDate="2099-10-13"
      disabled={false}
      onFollowUpDateChange={fn()}
      onFollowUpDateBlur={fn()}
      onResolve={fn()}
      onAcknowledge={fn()}
      onRemove={fn()}
      onBodyChange={fn()}
      onExitEditMode={fn()}
    />
  )
}

export const UntilClosed: Story = {
  name: 'the GitHub blocker waits until it is closed',
  args: {
    blocker,
    waitModeControl: waitModeControl('until-closed'),
  },
}

export const ReplyAcknowledged: Story = {
  name: 'the GitHub blocker appears resolved after acknowledgement',
  args: {
    blocker,
    waitModeControl: waitModeControl('until-closed'),
    resolved: true,
    children: replyWaitAppearance(true),
  },
}

export const UntilReply: Story = {
  name: 'the GitHub blocker waits for a reply',
  args: {
    blocker,
    waitModeControl: waitModeControl('until-reply'),
  },
}

export const ReplyReceived: Story = {
  name: 'the GitHub blocker highlights a reply that needs acknowledgement',
  args: {
    blocker,
    needsAcknowledgement: true,
    children: replyWaitAppearance(),
  },
}
