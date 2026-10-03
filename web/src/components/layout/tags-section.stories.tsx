import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { makeLabel, makeTask } from '#components/layout/sidebar-test-fixtures'
import { TagsSection } from '#components/layout/tags-section'
import type { Label } from '#hooks/use-labels'
import { labelKeys } from '#hooks/use-labels'
import type { Task } from '#hooks/use-tasks'
import { taskKeys } from '#hooks/use-tasks'
import { StoryRouter } from '#storybook-config/story-router'

const tasks: Task[] = [
  makeTask({ id: '1', title: 'An active task', labels: ['project/active'] }),
  makeTask({
    id: '2',
    title: 'A completed task',
    status: 'completed',
    labels: ['archive'],
  }),
]

const labels: Label[] = [
  makeLabel({ id: '1', name: 'project/active' }),
  makeLabel({ id: '2', name: 'archive' }),
  makeLabel({ id: '3', name: 'orphan' }),
  makeLabel({ id: '4', name: 'unused/group' }),
]

function TagsSectionStory({
  defaultShowOrphanTags = false,
}: {
  defaultShowOrphanTags?: boolean
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(taskKeys.list(undefined), tasks)
  queryClient.setQueryData(labelKeys.list({ context: 'personal' }), labels)

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen w-64 flex-col border-r border-border bg-sidebar">
        <TagsSection defaultShowOrphanTags={defaultShowOrphanTags} />
      </div>
    </QueryClientProvider>
  )
}

function TagsSectionStoryWithRouter(props: {
  defaultShowOrphanTags?: boolean
}) {
  return <StoryRouter component={() => <TagsSectionStory {...props} />} />
}

const meta = {
  title: 'Layout/TagsSection',
  component: TagsSectionStoryWithRouter,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TagsSectionStoryWithRouter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'the section hides labels that have no tasks',
}

export const ShowingOrphanTags: Story = {
  name: 'the section shows labels that have no tasks',
  args: { defaultShowOrphanTags: true },
}
