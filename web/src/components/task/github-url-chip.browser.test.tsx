import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  makeGithubLink,
  makeResolveGithubUrlResult,
} from '#components/task/github-link-test-fixtures'
import { GithubUrlChip } from '#components/task/github-url-chip'
import { makeTask } from '#components/task/task-row-test-fixtures'
import type { ResolveGithubUrlResult } from '#hooks/use-github-link'
import { githubUrlPreviewKeys } from '#hooks/use-github-url-preview'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to?: string }) => (
      <a href={typeof to === 'string' ? to : '#'}>{children}</a>
    ),
  }
})

const OPEN_ISSUE_URL = 'https://github.com/fohte/tq/issues/158'
const LINKED_ISSUE_URL = 'https://github.com/fohte/tq/issues/42'

function renderChip(url: string, result: ResolveGithubUrlResult | null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(githubUrlPreviewKeys.preview(url), result)

  return render(
    <QueryClientProvider client={queryClient}>
      <GithubUrlChip data={{ url }} raw={url} />
    </QueryClientProvider>,
  )
}

describe('GithubUrlChip', () => {
  it('shows the issue title and body in the popup when hovered', async () => {
    const user = userEvent.setup()
    renderChip(
      OPEN_ISSUE_URL,
      makeResolveGithubUrlResult({
        number: 158,
        kind: 'issue',
        url: OPEN_ISSUE_URL,
        title: 'Support live-preview chips and autocomplete for task mentions',
        body: 'Adds an InlineReferenceProvider abstraction so task mentions render as chips.',
        state: 'open',
      }),
    )

    await user.hover(screen.getByText('fohte/tq#158'))

    await waitFor(() =>
      expect(
        screen.getByText(
          'Adds an InlineReferenceProvider abstraction so task mentions render as chips.',
        ),
      ).toBeVisible(),
    )
  })

  it('shows a link to the linked TQ task in the popup when hovered', async () => {
    const user = userEvent.setup()
    renderChip(LINKED_ISSUE_URL, {
      linked: true,
      task: makeTask({
        githubLinks: [makeGithubLink({ url: LINKED_ISSUE_URL })],
      }),
    })

    await user.hover(screen.getByText('fohte/tq#42'))

    await waitFor(() =>
      expect(screen.getByText('Linked to a TQ task →')).toBeVisible(),
    )
  })
})
