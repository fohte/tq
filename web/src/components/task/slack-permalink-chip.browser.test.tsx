import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { SlackPermalinkChip } from '#components/task/slack-permalink-chip'
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
    renderWithPreview({
      channelId: 'C0123ABCDEF',
      channelName: 'general',
      isPrivate: false,
      authorName: 'Hayato Kawai',
      authorAvatarUrl: null,
      text: 'Deploy finished, everything looks green.',
      ts: '1699999999.000100',
      isThreadReply: false,
    })

    await user.hover(screen.getByText('Hayato Kawai:'))

    expect(
      await screen.findByText('Deploy finished, everything looks green.'),
    ).toBeVisible()
  })
})
