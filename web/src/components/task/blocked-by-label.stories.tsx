import type { Meta, StoryObj } from '@storybook/react-vite'

import { makeBlockedByGithubRef } from '#components/task/github-link-test-fixtures'
import { BlockedByLabel } from '#components/task/task-row-shared'

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
  },
}

export const MultipleBlockers: Story = {
  name: 'the badge lists several tasks blocking the current task',
  args: {
    blockedByNumbers: [312, 315],
    blockedByGithubRefs: [],
  },
}

export const SingleGithubBlocker: Story = {
  name: 'the badge links to one GitHub blocker',
  args: {
    blockedByNumbers: [],
    blockedByGithubRefs: [makeBlockedByGithubRef()],
  },
}

export const MultipleMixedBlockers: Story = {
  name: 'the badge counts task and GitHub blockers together',
  args: {
    blockedByNumbers: [312],
    blockedByGithubRefs: [makeBlockedByGithubRef()],
  },
}
