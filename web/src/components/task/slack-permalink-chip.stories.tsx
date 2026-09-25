import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { SlackPermalinkChip } from '#components/task/slack-permalink-chip'
import { makeSlackPermalinkPreview } from '#components/task/slack-permalink-test-fixtures'
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

// An inline data URI keeps the screenshot deterministic — an external URL
// may not finish loading before the screenshot is taken, making VRT captures
// flaky.
const AVATAR_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' fill='%2394a3b8'/%3E%3C/svg%3E"

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

function SlackPermalinkChipWithProviders({
  url,
  raw,
  preview,
  defaultOpen,
}: {
  url: string
  raw: string
  preview: SlackPermalinkPreview | null
  defaultOpen?: boolean | undefined
}) {
  return (
    <Providers url={url} preview={preview}>
      <p className="text-sm">
        See{' '}
        <SlackPermalinkChip
          data={{ url }}
          raw={raw}
          defaultOpen={defaultOpen}
        />{' '}
        for details.
      </p>
    </Providers>
  )
}

const meta = {
  title: 'Task/SlackPermalinkChip',
  component: SlackPermalinkChipWithProviders,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof SlackPermalinkChipWithProviders>

export default meta
type Story = StoryObj<typeof meta>

export const NormalMessage: Story = {
  name: 'the chip opens a preview of a Slack message with its author avatar',
  args: {
    url: NORMAL_MESSAGE_URL,
    raw: NORMAL_MESSAGE_URL,
    preview: makeSlackPermalinkPreview({ authorAvatarUrl: AVATAR_URL }),
    defaultOpen: true,
  },
}

export const ThreadReply: Story = {
  name: 'the chip links to a Slack reply in a private thread',
  args: {
    url: THREAD_REPLY_URL,
    raw: THREAD_REPLY_URL,
    preview: {
      channelId: 'C0123ABCDEF',
      channelName: 'incidents',
      isPrivate: true,
      authorName: 'Hayato Kawai',
      authorAvatarUrl: AVATAR_URL,
      text: 'Root cause was a stale cache entry.',
      ts: '1699999999.000200',
      isThreadReply: true,
    },
  },
}

export const LongText: Story = {
  name: 'the chip truncates a long Slack message to one line',
  args: {
    url: LONG_TEXT_URL,
    raw: LONG_TEXT_URL,
    preview: {
      channelId: 'C0123ABCDEF',
      channelName: 'general',
      isPrivate: false,
      authorName: 'Hayato Kawai',
      authorAvatarUrl: AVATAR_URL,
      text: 'This is a fairly long message body that should be truncated to a single line inside the inline chip trigger instead of overflowing the surrounding paragraph indefinitely.',
      ts: '1699999999.000300',
      isThreadReply: false,
    },
  },
}

export const BotMessageWithoutAvatar: Story = {
  name: 'the chip opens a bot message preview without an author avatar',
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
    defaultOpen: true,
  },
}

// The preview hasn't resolved yet (or resolved to "not a resolvable
// permalink"): the chip falls back to rendering the raw matched text.
export const Unresolved: Story = {
  name: 'the chip displays the raw link while the Slack preview is unresolved',
  args: {
    url: UNRESOLVED_URL,
    raw: UNRESOLVED_URL,
    preview: null,
  },
}
