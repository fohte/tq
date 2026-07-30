import type { Meta, StoryObj } from '@storybook/react-vite'

import { GithubRefSummary } from '#components/task/github-ref-summary'

const meta = {
  title: 'Task/GithubRefSummary',
  component: GithubRefSummary,
  parameters: {
    layout: 'centered',
  },
  render: (args) => (
    <p className="flex items-center gap-1 text-sm">
      <GithubRefSummary {...args} />
    </p>
  ),
} satisfies Meta<typeof GithubRefSummary>

export default meta
type Story = StoryObj<typeof meta>

export const OpenIssue: Story = {
  args: {
    kind: 'issue',
    state: 'open',
    owner: 'fohte',
    repo: 'tq',
    number: 158,
    title: 'Support live-preview chips and autocomplete for task mentions',
  },
}

export const ClosedIssue: Story = {
  args: {
    kind: 'issue',
    state: 'closed',
    owner: 'fohte',
    repo: 'tq',
    number: 42,
    title: 'Fix flaky test',
  },
}

export const OpenPullRequest: Story = {
  args: {
    kind: 'pull_request',
    state: 'open',
    owner: 'fohte',
    repo: 'tq',
    number: 160,
    title: 'Turn the task row status icon into a clickable status picker',
  },
}

export const MergedPullRequest: Story = {
  args: {
    kind: 'pull_request',
    state: 'merged',
    owner: 'fohte',
    repo: 'tq',
    number: 159,
    title: 'Auto-sync linked tasks with GitHub updates',
  },
}

export const ClosedPullRequest: Story = {
  args: {
    kind: 'pull_request',
    state: 'closed',
    owner: 'fohte',
    repo: 'tq',
    number: 33,
    title: 'Abandoned experiment',
  },
}

export const TruncatedTitle: Story = {
  args: {
    kind: 'issue',
    state: 'open',
    owner: 'fohte',
    repo: 'tq',
    number: 123,
    title:
      'This is a very long issue title that should be truncated instead of wrapping',
    titleClassName: 'max-w-48',
  },
}
