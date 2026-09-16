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
