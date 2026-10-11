import type { Meta, StoryObj } from '@storybook/react-vite'

import { makeBlockedByGithubRef } from '#components/task/github-link-test-fixtures'
import { BlockedByLabel } from '#components/task/task-row-shared'
import { makeTaskWaitSummary } from '#components/task/task-wait-test-fixtures'

const meta = {
  title: 'Task/BlockedByLabel',
  component: BlockedByLabel,
  tags: ['autodocs'],
} satisfies Meta<typeof BlockedByLabel>

export default meta
type Story = StoryObj<typeof meta>

export const SingleBlocker: Story = {
  name: 'the badge identifies one task blocking the current task',
  args: {
    blockedByNumbers: [312],
    blockedByGithubRefs: [],
    waits: [],
  },
}

export const MultipleBlockers: Story = {
  name: 'the badge counts task and GitHub blockers together',
  args: {
    blockedByNumbers: [312],
    blockedByGithubRefs: [makeBlockedByGithubRef()],
    waits: [],
  },
}

export const SingleGithubBlocker: Story = {
  name: 'the badge links to one GitHub blocker',
  args: {
    blockedByNumbers: [],
    blockedByGithubRefs: [makeBlockedByGithubRef()],
    waits: [],
  },
}

export const SingleWait: Story = {
  name: 'the badge shows one reply wait and its follow-up date',
  args: {
    blockedByNumbers: [],
    blockedByGithubRefs: [],
    waits: [makeTaskWaitSummary()],
  },
}

export const OverdueWait: Story = {
  name: 'the badge highlights an overdue follow-up date',
  args: {
    blockedByNumbers: [],
    blockedByGithubRefs: [],
    waits: [makeTaskWaitSummary({ followUpDate: '2000-01-01' })],
  },
}
