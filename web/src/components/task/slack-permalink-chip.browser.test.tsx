import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { SlackPermalinkChip } from '#components/task/slack-permalink-chip'
import { makeSlackPermalinkPreview } from '#components/task/slack-permalink-test-fixtures'
import type { SlackPermalinkPreview } from '#hooks/use-slack-permalink-preview'
import { slackPermalinkPreviewKeys } from '#hooks/use-slack-permalink-preview'

const PERMALINK_URL =
  'https://fohte-team.slack.com/archives/C0123ABCDEF/p1699999999000100'

function renderWithPreview(preview: SlackPermalinkPreview) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(
    slackPermalinkPreviewKeys.preview(PERMALINK_URL),
    preview,
  )

  return render(
    <QueryClientProvider client={queryClient}>
      <SlackPermalinkChip data={{ url: PERMALINK_URL }} raw={PERMALINK_URL} />
    </QueryClientProvider>,
  )
}

describe('SlackPermalinkChip', () => {
  it('shows the message text in a popup on hover', async () => {
    const user = userEvent.setup()
    renderWithPreview(makeSlackPermalinkPreview())

    await user.hover(screen.getByText('Hayato Kawai:'))

    // The trigger already renders the full (untruncated) message text, so a
    // plain screen.findByText would match it even if the popup never opens.
    // Scope the query to the popup to actually verify the hover behavior.
    await waitFor(() => {
      const popup = document.querySelector('[data-slot="preview-card-popup"]')
      if (!(popup instanceof HTMLElement)) {
        throw new Error('Expected the preview card popup to be in the DOM')
      }
      expect(
        within(popup).getByText('Deploy finished, everything looks green.'),
      ).toBeVisible()
    })
  })
})
