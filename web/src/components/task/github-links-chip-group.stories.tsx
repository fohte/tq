import type { Meta, StoryObj } from '@storybook/react-vite'

import {
  issueLink,
  makeGithubLink,
  mergedPrLink,
  openPrLink,
} from '#components/task/github-link-test-fixtures'
import { GithubLinksChipGroup } from '#components/task/github-links-chip-group'

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
  name: 'shows nothing when no GitHub links exist',
  args: { links: [] },
}

export const SingleLink: Story = {
  name: 'shows a single GitHub issue link',
  args: { links: [issueLink] },
}

export const RepresentativeIsLatestPullRequest: Story = {
  name: 'uses the latest pull request as the representative link',
  args: { links: [issueLink, mergedPrLink, openPrLink] },
}

export const RepresentativeFallsBackToLatestIssue: Story = {
  name: 'uses the latest issue when no pull request is linked',
  args: {
    links: [issueLink, makeGithubLink({ id: 'link-issue-2', number: 413 })],
  },
}

export const PopupOpen: Story = {
  name: 'opens the list of linked GitHub issues and pull requests',
  args: { links: [issueLink, mergedPrLink, openPrLink], defaultOpen: true },
}
