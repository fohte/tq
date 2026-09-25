import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { makeResolveGithubUrlResult } from '#components/task/github-link-test-fixtures'
import { GithubUrlCard } from '#components/task/github-url-card'
import { makeTask } from '#components/task/task-row-test-fixtures'
import type { ResolveGithubUrlResult } from '#hooks/use-github-link'
import { githubUrlPreviewKeys } from '#hooks/use-github-url-preview'
import { StoryRouter } from '#storybook-config/story-router'

const OPEN_ISSUE_URL = 'https://github.com/fohte/tq/issues/158'
const MERGED_PR_URL = 'https://github.com/fohte/tq/pull/159'
const CLOSED_ISSUE_URL = 'https://github.com/fohte/tq/issues/160'
const LINKED_ISSUE_URL = 'https://github.com/fohte/tq/issues/42'
const LONG_TITLE_URL = 'https://github.com/fohte/tq/issues/161'
const UNRESOLVED_ISSUE_URL = 'https://github.com/fohte/tq/issues/999'

function Providers({
  url,
  result,
  children,
}: {
  url: string
  result: ResolveGithubUrlResult | null
  children: ReactNode
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(githubUrlPreviewKeys.preview(url), result)

  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => <>{children}</>}
        paths={['/tasks/$taskId']}
      />
    </QueryClientProvider>
  )
}

function GithubUrlCardWithProviders({
  url,
  raw,
  result,
}: {
  url: string
  raw: string
  result: ResolveGithubUrlResult | null
}) {
  return (
    <Providers url={url} result={result}>
      <div className="w-full max-w-96">
        <GithubUrlCard data={{ url }} raw={raw} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/GithubUrlCard',
  component: GithubUrlCardWithProviders,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof GithubUrlCardWithProviders>

export default meta
type Story = StoryObj<typeof meta>

export const OpenIssue: Story = {
  name: 'previews an open issue with its title and body',
  args: {
    url: OPEN_ISSUE_URL,
    raw: OPEN_ISSUE_URL,
    result: makeResolveGithubUrlResult({
      number: 158,
      kind: 'issue',
      url: OPEN_ISSUE_URL,
      title: 'Support live-preview chips and autocomplete for task mentions',
      body: 'Adds an InlineReferenceProvider abstraction so task mentions render as chips.',
      state: 'open',
    }),
  },
}

export const MergedPullRequest: Story = {
  name: 'previews a merged pull request without a body excerpt',
  args: {
    url: MERGED_PR_URL,
    raw: MERGED_PR_URL,
    result: makeResolveGithubUrlResult({
      number: 159,
      kind: 'pull_request',
      url: MERGED_PR_URL,
      title: 'Auto-sync linked tasks with GitHub updates',
      body: null,
      state: 'merged',
    }),
  },
}

export const ClosedIssue: Story = {
  name: 'previews a closed issue with its body excerpt',
  args: {
    url: CLOSED_ISSUE_URL,
    raw: CLOSED_ISSUE_URL,
    result: makeResolveGithubUrlResult({
      number: 160,
      kind: 'issue',
      url: CLOSED_ISSUE_URL,
      title: 'Investigate flaky github-sync integration test',
      body: 'Turned out to be a shared fixture race under parallel execution.',
      state: 'closed',
    }),
  },
}

export const LinkedToTask: Story = {
  name: 'shows an issue card linked to an existing task',
  args: {
    url: LINKED_ISSUE_URL,
    raw: LINKED_ISSUE_URL,
    result: {
      linked: true,
      task: makeTask({
        id: '00000000-0000-0000-0000-000000000001',
        number: 7,
        title: 'Fix flaky test',
        githubLinks: [
          {
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
        ],
      }),
    },
  },
}

export const LongTitle: Story = {
  name: 'clamps a long issue title and body excerpt within the card',
  args: {
    url: LONG_TITLE_URL,
    raw: LONG_TITLE_URL,
    result: makeResolveGithubUrlResult({
      number: 161,
      kind: 'issue',
      url: LONG_TITLE_URL,
      title:
        'This is a very long GitHub issue title that should be clamped to two lines instead of overflowing the card layout indefinitely',
      body: 'This is a fairly long body excerpt that should be clamped to three lines instead of overflowing the card indefinitely, so the card keeps a predictable height regardless of how verbose the underlying issue body is.',
      state: 'open',
    }),
  },
}

// The preview hasn't resolved yet (or resolved to "not a real issue/PR"):
// the card falls back to rendering the raw matched text while its data is
// unresolved.
export const Unresolved: Story = {
  name: 'shows the raw URL while GitHub preview details are unavailable',
  args: {
    url: UNRESOLVED_ISSUE_URL,
    raw: UNRESOLVED_ISSUE_URL,
    result: null,
  },
}
