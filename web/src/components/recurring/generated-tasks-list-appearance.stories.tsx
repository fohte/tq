import type { Meta, StoryObj } from '@storybook/react-vite'

import { GeneratedTasksListAppearance } from '#components/recurring/generated-tasks-list-appearance'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { StoryRouter } from '#storybook-config/story-router'

const templateId = '00000000-0000-0000-0000-000000000001'
const sampleTasks = [
  makeTask({
    id: 'task-newer',
    number: 2,
    title: 'Write the weekly report',
    dueDate: '2026-03-27',
    templateId,
  }),
  makeTask({
    id: 'task-older',
    number: 1,
    title: 'Review the weekly report',
    dueDate: '2026-03-20',
    templateId,
  }),
]

const meta = {
  title: 'Recurring/GeneratedTasksListAppearance',
  component: GeneratedTasksListAppearance,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <StoryRouter
        component={() => (
          <div className="w-full max-w-96">
            <Story />
          </div>
        )}
        paths={['/tasks/$taskId']}
      />
    ),
  ],
  args: {
    tasks: sampleTasks,
    isLoading: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
  },
} satisfies Meta<typeof GeneratedTasksListAppearance>

export default meta
type Story = StoryObj<typeof meta>

export const WithTasks: Story = {
  name: 'the list shows generated tasks in server order',
}

export const Empty: Story = {
  name: 'the list explains that no tasks have been generated',
  args: {
    tasks: [],
  },
}

export const Loading: Story = {
  name: 'the list shows an initial loading message',
  args: {
    tasks: [],
    isLoading: true,
  },
}

export const LoadingNextPage: Story = {
  name: 'the list shows a loading message while fetching another page',
  args: {
    hasNextPage: true,
    isFetchingNextPage: true,
  },
}

export const NextPageError: Story = {
  name: 'the list offers a retry when another page fails to load',
  args: {
    hasNextPage: true,
    isFetchNextPageError: true,
  },
}
