import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { expect, within } from 'storybook/test'

import { GithubUrlChip } from '#components/task/github-url-chip'
import type { ResolveGithubUrlResult } from '#hooks/use-github-link'
import { githubUrlPreviewKeys } from '#hooks/use-github-url-preview'

const OPEN_ISSUE_URL = 'https://github.com/fohte/tq/issues/158'
const MERGED_PR_URL = 'https://github.com/fohte/tq/pull/159'
const LINKED_ISSUE_URL = 'https://github.com/fohte/tq/issues/42'

function Providers({
  url,
  result,
  children,
}: {
  url: string
  result: ResolveGithubUrlResult
  children: ReactNode
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(githubUrlPreviewKeys.preview(url), result)

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function GithubUrlChipWithProviders({
  url,
  result,
}: {
  url: string
  result: ResolveGithubUrlResult
}) {
  return (
    <Providers url={url} result={result}>
      <p className="text-sm">
        See <GithubUrlChip data={{ url }} /> for details.
      </p>
    </Providers>
  )
}

const meta = {
  title: 'Task/GithubUrlChip',
  component: GithubUrlChipWithProviders,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof GithubUrlChipWithProviders>

export default meta
type Story = StoryObj<typeof meta>

export const OpenIssue: Story = {
  args: {
    url: OPEN_ISSUE_URL,
    result: {
      linked: false,
      preview: {
        owner: 'fohte',
        repo: 'tq',
        number: 158,
        kind: 'issue',
        url: OPEN_ISSUE_URL,
        title: 'Support live-preview chips and autocomplete for task mentions',
        body: 'Adds an InlineReferenceProvider abstraction so task mentions render as chips.',
        state: 'open',
      },
    },
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    // The chip is mounted into its own React root (no RouterProvider) in
    // production, so this exercises the exact same isolation the real
    // ProseMirror widget does: hovering must open the preview card and
    // render its content without throwing. The popup renders via a portal,
    // so it must be queried against the document body.
    await userEvent.hover(canvas.getByText('fohte/tq#158'))
    const body = within(canvasElement.ownerDocument.body)
    await expect(
      await body.findByText(
        'Adds an InlineReferenceProvider abstraction so task mentions render as chips.',
      ),
    ).toBeVisible()
  },
}

export const MergedPullRequest: Story = {
  args: {
    url: MERGED_PR_URL,
    result: {
      linked: false,
      preview: {
        owner: 'fohte',
        repo: 'tq',
        number: 159,
        kind: 'pull_request',
        url: MERGED_PR_URL,
        title: 'Auto-sync linked tasks with GitHub updates',
        body: null,
        state: 'merged',
      },
    },
  },
}

export const LinkedToTask: Story = {
  args: {
    url: LINKED_ISSUE_URL,
    result: {
      linked: true,
      task: {
        id: '00000000-0000-0000-0000-000000000001',
        number: 7,
        title: 'Fix flaky test',
        description: null,
        status: 'in_progress',
        context: 'dev',
        startDate: null,
        dueDate: null,
        estimatedMinutes: null,
        parentId: null,
        projectId: null,
        recurrenceRuleId: null,
        recurrenceRule: null,
        githubLink: {
          id: 'link-1',
          owner: 'fohte',
          repo: 'tq',
          number: 42,
          kind: 'issue',
          url: LINKED_ISSUE_URL,
          state: 'open',
          title: 'Fix flaky test',
          lastSyncedAt: '2026-03-20T00:00:00.000Z',
        },
        sortOrder: 0,
        createdAt: '2026-03-20T00:00:00.000Z',
        updatedAt: '2026-03-20T00:00:00.000Z',
      },
    },
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.hover(canvas.getByText('fohte/tq#42'))
    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByText('Linked to a TQ task →')).toBeVisible()
  },
}
