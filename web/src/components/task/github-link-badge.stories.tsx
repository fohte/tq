import type { Meta, StoryObj } from '@storybook/react-vite'

import { GithubLinkBadge } from '#components/task/github-link-badge'
import type { GithubLink } from '#hooks/use-github-link'

function makeLink(overrides: Partial<GithubLink> = {}): GithubLink {
  return {
    id: 'link-1',
    owner: 'fohte',
    repo: 'tq',
    number: 42,
    kind: 'issue',
    url: 'https://github.com/fohte/tq/issues/42',
    state: 'open',
    title: 'Sample issue',
    lastSyncedAt: '2026-03-20T00:00:00.000Z',
    ...overrides,
  }
}

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
  args: { link: makeLink({ state: 'open', kind: 'issue' }) },
}

export const ClosedIssue: Story = {
  args: { link: makeLink({ state: 'closed', kind: 'issue' }) },
}

export const OpenPullRequest: Story = {
  args: {
    link: makeLink({
      state: 'open',
      kind: 'pull_request',
      number: 7,
      url: 'https://github.com/fohte/tq/pull/7',
    }),
  },
}

export const MergedPullRequest: Story = {
  args: {
    link: makeLink({
      state: 'merged',
      kind: 'pull_request',
      number: 7,
      url: 'https://github.com/fohte/tq/pull/7',
    }),
  },
}

export const ClosedPullRequest: Story = {
  args: {
    link: makeLink({
      state: 'closed',
      kind: 'pull_request',
      number: 7,
      url: 'https://github.com/fohte/tq/pull/7',
    }),
  },
}

export const WithExtraCount: Story = {
  args: {
    link: makeLink({
      state: 'merged',
      kind: 'pull_request',
      number: 436,
      url: 'https://github.com/fohte/tq/pull/436',
    }),
    extraCount: 2,
  },
}
