import type { Meta, StoryObj } from '@storybook/react-vite'

import { GithubLinkBadge } from '#components/task/github-link-badge'
import { makeGithubLink } from '#components/task/github-link-test-fixtures'

const meta = {
  title: 'Task/GithubLinkBadge',
  component: GithubLinkBadge,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="dark bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GithubLinkBadge>

export default meta
type Story = StoryObj<typeof meta>

export const OpenIssue: Story = {
  name: 'shows an open issue link',
  args: { link: makeGithubLink({ state: 'open', kind: 'issue' }) },
}

export const ClosedIssue: Story = {
  name: 'shows a closed issue link',
  args: { link: makeGithubLink({ state: 'closed', kind: 'issue' }) },
}

export const OpenPullRequest: Story = {
  name: 'shows an open pull request link',
  args: {
    link: makeGithubLink({
      state: 'open',
      kind: 'pull_request',
      number: 7,
      url: 'https://github.com/fohte/tq/pull/7',
    }),
  },
}

export const MergedPullRequest: Story = {
  name: 'shows a merged pull request link',
  args: {
    link: makeGithubLink({
      state: 'merged',
      kind: 'pull_request',
      number: 7,
      url: 'https://github.com/fohte/tq/pull/7',
    }),
  },
}

export const ClosedPullRequest: Story = {
  name: 'shows a closed pull request link',
  args: {
    link: makeGithubLink({
      state: 'closed',
      kind: 'pull_request',
      number: 7,
      url: 'https://github.com/fohte/tq/pull/7',
    }),
  },
}

export const WithExtraCount: Story = {
  name: 'shows the number of additional linked items',
  args: {
    link: makeGithubLink({
      state: 'merged',
      kind: 'pull_request',
      number: 436,
      url: 'https://github.com/fohte/tq/pull/436',
    }),
    extraCount: 2,
  },
}
