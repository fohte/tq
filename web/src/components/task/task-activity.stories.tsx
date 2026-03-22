import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { TaskActivity } from '@web/components/task/task-activity'
import type { ReactNode } from 'react'

const baseComments = [
  {
    id: 'comment-1',
    taskId: 'task-1',
    content: 'Started working on this. The API layer looks straightforward.',
    createdAt: new Date(Date.now() - 3_600_000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3_600_000 * 2).toISOString(),
  },
  {
    id: 'comment-2',
    taskId: 'task-1',
    content:
      'Found an edge case with empty strings. Need to add validation on the frontend too.',
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
    updatedAt: new Date(Date.now() - 1_800_000).toISOString(),
  },
  {
    id: 'comment-3',
    taskId: 'task-1',
    content: 'All tests passing now. Ready for review.',
    createdAt: new Date(Date.now() - 600_000).toISOString(),
    updatedAt: new Date(Date.now() - 600_000).toISOString(),
  },
]

function Providers({
  children,
  comments = [],
}: {
  children: ReactNode
  comments?: typeof baseComments
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  // Pre-populate query cache with comments
  queryClient.setQueryData(['tasks', 'task-1', 'comments'], comments)

  const rootRoute = createRootRoute({
    component: () => <>{children}</>,
  })

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

function ActivityStory({ comments = [] }: { comments?: typeof baseComments }) {
  return (
    <Providers comments={comments}>
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
  },
}

export const WithComments: Story = {
  args: {
    comments: baseComments,
  },
}

export const SingleComment: Story = {
  args: {
    comments: [baseComments[0]!],
  },
}

export const ManyComments: Story = {
  args: {
    comments: Array.from({ length: 10 }, (_, i) => ({
      id: `comment-${i}`,
      taskId: 'task-1',
      content: `Comment #${i + 1}: This is a sample comment for testing scroll behavior and layout with many items.`,
      createdAt: new Date(Date.now() - 3_600_000 * (10 - i)).toISOString(),
      updatedAt: new Date(Date.now() - 3_600_000 * (10 - i)).toISOString(),
    })),
  },
}
