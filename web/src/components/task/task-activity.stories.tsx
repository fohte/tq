import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { TaskActivity } from '#components/task/task-activity'
import type { ActivityItem } from '#hooks/use-task-activity'
import type { Comment } from '#hooks/use-task-comments'
import { taskMentionKeys } from '#hooks/use-task-mentions'
import { StoryRouter } from '#storybook-config/story-router'

const baseComments: Comment[] = [
  {
    id: 'comment-1',
    taskId: 'task-1',
    content: 'Started working on this. The API layer looks straightforward.',
    createdAt: new Date(Date.now() - 3_600_000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3_600_000 * 2).toISOString(),
    author: null,
  },
  {
    id: 'comment-2',
    taskId: 'task-1',
    content:
      'Found an edge case with empty strings. Need to add validation on the frontend too.',
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
    updatedAt: new Date(Date.now() - 1_800_000).toISOString(),
    author: null,
  },
  {
    id: 'comment-3',
    taskId: 'task-1',
    content: 'All tests passing now. Ready for review.',
    createdAt: new Date(Date.now() - 600_000).toISOString(),
    updatedAt: new Date(Date.now() - 600_000).toISOString(),
    author: null,
  },
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
  args: {
    comments: [],
    events: [],
  },
}

export const WithComments: Story = {
  args: {
    comments: baseComments,
    events: [],
  },
}

const [firstComment] = baseComments

export const SingleComment: Story = {
  args: {
    comments: firstComment ? [firstComment] : [],
    events: [],
  },
}

export const ManyComments: Story = {
  args: {
    comments: Array.from({ length: 10 }, (_, i) => ({
      id: `comment-${String(i)}`,
      taskId: 'task-1',
      content: `Comment #${String(i + 1)}: This is a sample comment for testing scroll behavior and layout with many items.`,
      createdAt: new Date(Date.now() - 3_600_000 * (10 - i)).toISOString(),
      updatedAt: new Date(Date.now() - 3_600_000 * (10 - i)).toISOString(),
      author: null,
    })),
    events: [],
  },
}

export const LlmAuthored: Story = {
  args: {
    comments: [
      ...baseComments,
      {
        id: 'comment-4',
        taskId: 'task-1',
        content: 'Applied the suggested fix and re-ran the test suite.',
        createdAt: new Date(Date.now() - 300_000).toISOString(),
        updatedAt: new Date(Date.now() - 300_000).toISOString(),
        author: { kind: 'llm', agent: 'claude-opus-5' },
      },
    ],
    events: [],
  },
}

export const MixedTimeline: Story = {
  args: {
    comments: [
      {
        id: 'comment-1',
        taskId: 'task-1',
        content:
          'greedy な詰め方をやめたら auto-schedule の作り直しが 1/3 になった。minBlock のガードは別 PR に切る。',
        createdAt: new Date(Date.now() - 3_600_000 * 3).toISOString(),
        updatedAt: new Date(Date.now() - 3_600_000 * 3).toISOString(),
        author: null,
      },
      {
        id: 'comment-2',
        taskId: 'task-1',
        content: 'Applied the suggested fix and re-ran the test suite.',
        createdAt: new Date(Date.now() - 300_000).toISOString(),
        updatedAt: new Date(Date.now() - 300_000).toISOString(),
        author: { kind: 'llm', agent: 'claude-opus-5' },
      },
    ],
    events: [
      {
        id: 'event-1',
        type: 'created',
        createdAt: new Date(Date.now() - 3_600_000 * 6).toISOString(),
        author: { kind: 'human', agent: null },
      },
      {
        id: 'event-2',
        type: 'github_linked',
        createdAt: new Date(Date.now() - 3_600_000 * 5).toISOString(),
        author: { kind: 'human', agent: null },
        owner: 'fohte',
        repo: 'tq',
        number: 212,
        kind: 'issue',
      },
      {
        id: 'event-3',
        type: 'status_changed',
        createdAt: new Date(Date.now() - 3_600_000 * 2).toISOString(),
        author: { kind: 'human', agent: null },
        fromStatus: 'todo',
        toStatus: 'in_progress',
        toStatusReason: null,
      },
    ],
  },
}
