import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { expect } from 'storybook/test'

import { SlackPermalinkCard } from '#components/task/slack-permalink-card'
import type { SlackPermalinkPreview } from '#hooks/use-slack-permalink-preview'
import { slackPermalinkPreviewKeys } from '#hooks/use-slack-permalink-preview'

const NORMAL_MESSAGE_URL =
  'https://fohte-team.slack.com/archives/C0123ABCDEF/p1699999999000100'
const THREAD_REPLY_URL =
  'https://fohte-team.slack.com/archives/C0123ABCDEF/p1699999999000200?thread_ts=1699999999.000100&cid=C0123ABCDEF'
const LONG_TEXT_URL =
  'https://fohte-team.slack.com/archives/C0123ABCDEF/p1699999999000300'
const BOT_MESSAGE_URL =
  'https://fohte-team.slack.com/archives/C0456GHIJKL/p1699999999000400'
const UNRESOLVED_URL =
  'https://fohte-team.slack.com/archives/C0999ZZZZZZ/p1699999999999900'

function Providers({
  url,
  preview,
  children,
}: {
  url: string
  preview: SlackPermalinkPreview | null
  children: ReactNode
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(slackPermalinkPreviewKeys.preview(url), preview)

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function SlackPermalinkCardWithProviders({
  url,
  raw,
  preview,
}: {
  url: string
  raw: string
  preview: SlackPermalinkPreview | null
}) {
  return (
    <Providers url={url} preview={preview}>
      <div className="w-96">
        <SlackPermalinkCard data={{ url }} raw={raw} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/SlackPermalinkCard',
  component: SlackPermalinkCardWithProviders,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof SlackPermalinkCardWithProviders>

export default meta
type Story = StoryObj<typeof meta>

export const NormalMessage: Story = {
  args: {
    url: NORMAL_MESSAGE_URL,
    raw: NORMAL_MESSAGE_URL,
    preview: {
      channelId: 'C0123ABCDEF',
      channelName: 'general',
      isPrivate: false,
      authorName: 'Hayato Kawai',
      authorAvatarUrl: 'https://placehold.co/64x64',
      text: 'Deploy finished, everything looks green.',
      ts: '1699999999.000100',
      isThreadReply: false,
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Hayato Kawai')).toBeVisible()
    await expect(canvas.getByText('#general')).toBeVisible()
    await expect(
      canvas.getByText('Deploy finished, everything looks green.'),
    ).toBeVisible()
  },
}

export const ThreadReply: Story = {
  args: {
    url: THREAD_REPLY_URL,
    raw: THREAD_REPLY_URL,
    preview: {
      channelId: 'C0123ABCDEF',
      channelName: 'incidents',
      isPrivate: true,
      authorName: 'Hayato Kawai',
      authorAvatarUrl: 'https://placehold.co/64x64',
      text: 'Root cause was a stale cache entry.',
      ts: '1699999999.000200',
      isThreadReply: true,
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('thread reply')).toBeVisible()
  },
}

export const LongText: Story = {
  args: {
    url: LONG_TEXT_URL,
    raw: LONG_TEXT_URL,
    preview: {
      channelId: 'C0123ABCDEF',
      channelName: 'general',
      isPrivate: false,
      authorName: 'Hayato Kawai',
      authorAvatarUrl: 'https://placehold.co/64x64',
      text: 'This is a fairly long message body that should be clamped to three lines instead of overflowing the card indefinitely, so the card keeps a predictable height regardless of how verbose the underlying Slack message is, even across many additional sentences of filler text.',
      ts: '1699999999.000300',
      isThreadReply: false,
    },
  },
}

export const BotMessageWithoutAvatar: Story = {
  args: {
    url: BOT_MESSAGE_URL,
    raw: BOT_MESSAGE_URL,
    preview: {
      channelId: 'C0456GHIJKL',
      channelName: 'ci-alerts',
      isPrivate: false,
      authorName: 'CI Bot',
      authorAvatarUrl: null,
      text: 'Build #482 failed on main.',
      ts: '1699999999.000400',
      isThreadReply: false,
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('CI Bot')).toBeVisible()
  },
}

// The preview hasn't resolved yet (or resolved to "not a resolvable
// permalink"): the card falls back to rendering the raw matched text while
// its data is unresolved.
export const Unresolved: Story = {
  args: {
    url: UNRESOLVED_URL,
    raw: UNRESOLVED_URL,
    preview: null,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(UNRESOLVED_URL)).toBeVisible()
  },
}
