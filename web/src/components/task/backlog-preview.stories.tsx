import type { Meta, StoryObj } from '@storybook/react-vite'
import { BacklogPreview } from '@web/components/task/backlog-preview'
import type { Task } from '@web/hooks/use-tasks'
import { fn } from 'storybook/test'

const makeBacklogTasks = (count: number): Task[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `00000000-0000-0000-0000-00000000000${i}`,
    title: `Backlog task ${i + 1}`,
    description: null,
    status: 'todo' as const,
    context: 'personal' as const,
    startDate: null,
    dueDate: null,
    estimatedMinutes: null,
    parentId: null,
    projectId: null,
    sortOrder: i,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
  }))

const meta = {
  title: 'Task/BacklogPreview',
  component: BacklogPreview,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  args: {
    onViewAll: fn(),
  },
} satisfies Meta<typeof BacklogPreview>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: {
    tasks: [],
  },
}

export const FewTasks: Story = {
  args: {
    tasks: makeBacklogTasks(2),
  },
}

export const WithViewAll: Story = {
  args: {
    tasks: makeBacklogTasks(5),
  },
}
