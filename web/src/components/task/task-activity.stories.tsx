import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { TaskActivity } from '#components/task/task-activity'
import { makeComment } from '#components/task/task-activity-test-fixtures'
import { makeAuthorInfo } from '#components/task/task-author-test-fixtures'
import type { ActivityItem } from '#hooks/use-task-activity'
import type { Comment } from '#hooks/use-task-comments'
import { taskMentionKeys } from '#lib/query-keys'
import { StoryRouter } from '#storybook-config/story-router'

const baseComments: Comment[] = [
  makeComment({
    id: 'comment-1',
    content: 'Started working on this. The API layer looks straightforward.',
    createdAt: new Date(Date.now() - 3_600_000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3_600_000 * 2).toISOString(),
  }),
  makeComment({
    id: 'comment-2',
    content:
      'Found an edge case with empty strings. Need to add validation on the frontend too.',
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
    updatedAt: new Date(Date.now() - 1_800_000).toISOString(),
  }),
  makeComment({
    id: 'comment-3',
    content: 'All tests passing now. Ready for review.',
    createdAt: new Date(Date.now() - 600_000).toISOString(),
    updatedAt: new Date(Date.now() - 600_000).toISOString(),
  }),
]

function Providers({
  children,
  comments = [],
  events = [],
}: {
  children: ReactNode
  comments?: Comment[]
  events?: ActivityItem[]
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })

  // Pre-populate query caches with comments and activity events
  queryClient.setQueryData(['tasks', 'task-1', 'comments'], comments)
  queryClient.setQueryData(['tasks', 'task-1', 'activity'], events)

  // ManyComments' bodies contain "#1".."#10" task-mention text, which
  // MarkdownEditor's mention plugin resolves via useTaskMentionPreview. Seed
  // them as unresolved (null) so the chip falls back to raw text instead of
  // hitting the network; harmless for stories whose comments don't mention
  // any of these numbers.
  for (let number = 1; number <= 10; number++) {
    queryClient.setQueryData(taskMentionKeys.preview(number), null)
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter component={() => <>{children}</>} />
    </QueryClientProvider>
  )
}

function ActivityStory({
  comments = [],
  events = [],
}: {
  comments?: Comment[]
  events?: ActivityItem[]
}) {
  return (
    <Providers comments={comments} events={events}>
      <div className="max-w-2xl p-6">
        <TaskActivity taskId="task-1" />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/TaskActivity',
  component: ActivityStory,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ActivityStory>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  name: 'the activity timeline has no comments or events',
  args: {
    comments: [],
    events: [],
  },
}

export const WithComments: Story = {
  name: 'the timeline shows several comments',
  args: {
    comments: baseComments,
    events: [],
  },
}

const [firstComment] = baseComments

export const SingleComment: Story = {
  name: 'the timeline shows a single comment',
  args: {
    comments: firstComment ? [firstComment] : [],
    events: [],
  },
}

export const ManyComments: Story = {
  name: 'the timeline shows enough comments to fill a long list',
  args: {
    comments: Array.from({ length: 10 }, (_, i) => {
      const timestamp = new Date(
        Date.now() - 3_600_000 * (10 - i),
      ).toISOString()
      return makeComment({
        id: `comment-${String(i)}`,
        content: `Comment #${String(i + 1)}: This is a sample comment for testing scroll behavior and layout with many items.`,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    }),
    events: [],
  },
}

export const LlmAuthored: Story = {
  name: 'the timeline includes a comment authored by an LLM',
  args: {
    comments: [
      ...baseComments,
      makeComment({
        id: 'comment-4',
        content: 'Applied the suggested fix and re-ran the test suite.',
        createdAt: new Date(Date.now() - 300_000).toISOString(),
        updatedAt: new Date(Date.now() - 300_000).toISOString(),
        author: makeAuthorInfo({ kind: 'llm', agent: 'sample-agent' }),
      }),
    ],
    events: [],
  },
}

export const MixedTimeline: Story = {
  name: 'the timeline combines comments with task events',
  args: {
    comments: [
      makeComment({
        id: 'comment-1',
        content:
          'greedy な詰め方をやめたら auto-schedule の作り直しが 1/3 になった。minBlock のガードは別 PR に切る。',
        createdAt: new Date(Date.now() - 3_600_000 * 3).toISOString(),
        updatedAt: new Date(Date.now() - 3_600_000 * 3).toISOString(),
      }),
      makeComment({
        id: 'comment-2',
        content: 'Applied the suggested fix and re-ran the test suite.',
        createdAt: new Date(Date.now() - 300_000).toISOString(),
        updatedAt: new Date(Date.now() - 300_000).toISOString(),
        author: makeAuthorInfo({ kind: 'llm', agent: 'sample-agent' }),
      }),
    ],
    events: [
      {
        id: 'event-1',
        type: 'created',
        createdAt: new Date(Date.now() - 3_600_000 * 6).toISOString(),
        author: makeAuthorInfo(),
      },
      {
        id: 'event-2',
        type: 'github_linked',
        createdAt: new Date(Date.now() - 3_600_000 * 5).toISOString(),
        author: makeAuthorInfo(),
        owner: 'fohte',
        repo: 'tq',
        number: 212,
        kind: 'issue',
      },
      {
        id: 'event-3',
        type: 'status_changed',
        createdAt: new Date(Date.now() - 3_600_000 * 2).toISOString(),
        author: makeAuthorInfo(),
        fromStatus: 'todo',
        toStatus: 'in_progress',
        toStatusReason: null,
      },
    ],
  },
}
