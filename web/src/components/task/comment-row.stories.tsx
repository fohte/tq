import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { CommentRow } from '#components/task/comment-row'
import { makeComment } from '#components/task/task-activity-test-fixtures'
import type { Comment } from '#hooks/use-task-comments'
import { StoryRouter } from '#storybook-config/story-router'

function CommentRowStory({
  comment,
  initiallyEditing = false,
  defaultMenuOpen,
}: {
  comment: Comment
  initiallyEditing?: boolean
  defaultMenuOpen?: 'desktop' | 'mobile' | undefined
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => (
          <div className="max-w-2xl p-6">
            <CommentRow
              taskId="task-1"
              comment={comment}
              initiallyEditing={initiallyEditing}
              defaultMenuOpen={defaultMenuOpen}
            />
          </div>
        )}
      />
    </QueryClientProvider>
  )
}

const meta = {
  title: 'Task/CommentRow',
  component: CommentRowStory,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    comment: makeComment(),
  },
} satisfies Meta<typeof CommentRowStory>

export default meta
type Story = StoryObj<typeof meta>

export const ReadOnly: Story = {
  name: 'the comment stays read-only until Edit is selected',
}

export const DesktopMenuOpen: Story = {
  name: 'the desktop menu shows Edit and Delete',
  tags: ['desktop-only'],
  args: {
    defaultMenuOpen: 'desktop',
  },
}

export const MobileActionSheetOpen: Story = {
  name: 'the mobile sheet shows Edit and Delete',
  tags: ['mobile-only'],
  args: {
    defaultMenuOpen: 'mobile',
  },
}

export const Editing: Story = {
  name: 'the comment is open in the editor',
  args: {
    initiallyEditing: true,
  },
}
