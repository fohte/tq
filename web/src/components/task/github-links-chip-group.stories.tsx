import type { Meta, StoryObj } from '@storybook/react-vite'

import { makeGithubLink } from '#components/task/github-link-test-fixtures'
import { GithubLinksChipGroup } from '#components/task/github-links-chip-group'

const issueLink = makeGithubLink({
  id: 'link-issue',
  number: 412,
  kind: 'issue',
  state: 'open',
  title: 'Support multiple GitHub links per task',
  url: 'https://github.com/fohte/tq/issues/412',
})

const mergedPrLink = makeGithubLink({
  id: 'link-pr-436',
  number: 436,
  kind: 'pull_request',
  state: 'merged',
  title: 'api: allow associating multiple GitHub links with a task',
  url: 'https://github.com/fohte/tq/pull/436',
})

const openPrLink = makeGithubLink({
  id: 'link-pr-441',
  number: 441,
  kind: 'pull_request',
  state: 'open',
  title: 'web: show representative chip with +N and hover popup',
  url: 'https://github.com/fohte/tq/pull/441',
})

const meta = {
  title: 'Task/GithubLinksChipGroup',
  component: GithubLinksChipGroup,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="dark border border-border bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GithubLinksChipGroup>

export default meta
type Story = StoryObj<typeof meta>

export const NoLinks: Story = {
  args: { links: [] },
}

export const SingleLink: Story = {
  args: { links: [issueLink] },
}

export const RepresentativeIsLatestPullRequest: Story = {
  args: { links: [issueLink, mergedPrLink, openPrLink] },
}

export const RepresentativeFallsBackToLatestIssue: Story = {
  args: {
    links: [issueLink, makeGithubLink({ id: 'link-issue-2', number: 413 })],
  },
}

export const PopupOpen: Story = {
  args: { links: [issueLink, mergedPrLink, openPrLink], defaultOpen: true },
}
