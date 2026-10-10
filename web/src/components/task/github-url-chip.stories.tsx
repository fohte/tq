import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import {
  makeGithubLink,
  makeResolveGithubUrlResult,
} from '#components/task/github-link-test-fixtures'
import { GithubUrlChip } from '#components/task/github-url-chip'
import { makeTaskWithDescription } from '#components/task/task-row-test-fixtures'
import type { ResolveGithubUrlResult } from '#hooks/use-github-link'
import { githubUrlPreviewKeys } from '#lib/query-keys'
import { StoryRouter } from '#storybook-config/story-router'

const OPEN_ISSUE_URL = 'https://github.com/fohte/tq/issues/158'
const MERGED_PR_URL = 'https://github.com/fohte/tq/pull/159'
const LINKED_ISSUE_URL = 'https://github.com/fohte/tq/issues/42'
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

function GithubUrlChipWithProviders({
  url,
  raw,
  result,
  defaultOpen,
}: {
  url: string
  raw: string
  result: ResolveGithubUrlResult | null
  defaultOpen?: boolean | undefined
}) {
  return (
    <Providers url={url} result={result}>
      <p className="text-sm">
        See <GithubUrlChip data={{ url }} raw={raw} defaultOpen={defaultOpen} />{' '}
        for details.
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
  name: 'opens an issue preview from an inline GitHub URL',
  args: {
    url: OPEN_ISSUE_URL,
    raw: OPEN_ISSUE_URL,
    defaultOpen: true,
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
  name: 'shows a merged pull request as an inline chip',
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

export const LinkedToTask: Story = {
  name: 'opens an issue preview linked to an existing task',
  args: {
    url: LINKED_ISSUE_URL,
    raw: LINKED_ISSUE_URL,
    defaultOpen: true,
    result: {
      linked: true,
      task: makeTaskWithDescription({
        id: '00000000-0000-0000-0000-000000000001',
        number: 7,
        title: 'Fix flaky test',
        githubLinks: [
          makeGithubLink({
            url: LINKED_ISSUE_URL,
            title: 'Fix flaky test',
          }),
        ],
      }),
    },
  },
}

// The preview hasn't resolved yet (or resolved to "not a real issue/PR"):
// the chip falls back to rendering the raw matched text instead of a card.
export const Unresolved: Story = {
  name: 'shows the raw URL while GitHub preview details are unavailable',
  args: {
    url: UNRESOLVED_ISSUE_URL,
    raw: UNRESOLVED_ISSUE_URL,
    result: null,
  },
}
