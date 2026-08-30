import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor, within } from 'storybook/test'

import { GithubLinksChipGroup } from '#components/task/github-links-chip-group'
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

const issueLink = makeLink({
  id: 'link-issue',
  number: 412,
  kind: 'issue',
  state: 'open',
  title: 'Support multiple GitHub links per task',
  url: 'https://github.com/fohte/tq/issues/412',
})

const mergedPrLink = makeLink({
  id: 'link-pr-436',
  number: 436,
  kind: 'pull_request',
  state: 'merged',
  title: 'api: allow associating multiple GitHub links with a task',
  url: 'https://github.com/fohte/tq/pull/436',
})

const openPrLink = makeLink({
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
  play: async ({ canvas }) => {
    await expect(
      canvas.queryByTestId('github-links-chip'),
    ).not.toBeInTheDocument()
  },
}

export const SingleLink: Story = {
  args: { links: [issueLink] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('tq#412')).toBeVisible()
    await expect(
      canvas.queryByTestId('github-links-chip'),
    ).not.toBeInTheDocument()
  },
}

export const RepresentativeIsLatestPullRequest: Story = {
  args: { links: [issueLink, mergedPrLink, openPrLink] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('tq#441')).toBeVisible()
    await expect(canvas.getByText('+2')).toBeVisible()
  },
}

export const RepresentativeFallsBackToLatestIssue: Story = {
  args: {
    links: [issueLink, makeLink({ id: 'link-issue-2', number: 413 })],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('tq#413')).toBeVisible()
    await expect(canvas.getByText('+1')).toBeVisible()
  },
}

export const OpensPopupOnHover: Story = {
  args: { links: [issueLink, mergedPrLink, openPrLink] },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.hover(canvas.getByTestId('github-links-chip'))

    const body = within(canvasElement.ownerDocument.body)
    await waitFor(() => expect(body.getByText('GITHUB (3)')).toBeVisible())
    await expect(
      body.getByText('Support multiple GitHub links per task'),
    ).toBeVisible()
    await expect(
      body.getByText(
        'api: allow associating multiple GitHub links with a task',
      ),
    ).toBeVisible()
    await expect(
      body.getByText('web: show representative chip with +N and hover popup'),
    ).toBeVisible()
  },
}
