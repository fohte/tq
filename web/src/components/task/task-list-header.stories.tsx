import type { Meta, StoryObj } from '@storybook/react-vite'
import { TaskListHeader } from '@web/components/task/task-list-header'
import type { Task } from '@web/hooks/use-tasks'

const makeTasks = (overrides: Array<Partial<Task>>): Task[] =>
  overrides.map((o, i) => ({
    id: `00000000-0000-0000-0000-00000000000${i}`,
    title: `Task ${i + 1}`,
    description: null,
    status: 'todo' as const,
    context: 'personal' as const,
    startDate: null,
    dueDate: null,
    estimatedMinutes: null,
    parentId: null,
    projectId: null,
    sortOrder: i,
    recurrenceRuleId: null,
    recurrenceRule: null,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    ...o,
  }))

const meta = {
  title: 'Task/TaskListHeader',
  component: TaskListHeader,
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
} satisfies Meta<typeof TaskListHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: {
    tasks: [],
  },
}

export const NoneCompleted: Story = {
  args: {
    tasks: makeTasks([
      { title: 'Task A', estimatedMinutes: 60 },
      { title: 'Task B', estimatedMinutes: 30 },
      { title: 'Task C', estimatedMinutes: 45 },
    ]),
  },
}

export const PartiallyCompleted: Story = {
  args: {
    tasks: makeTasks([
      { title: 'Task A', status: 'completed', estimatedMinutes: 60 },
      { title: 'Task B', status: 'completed', estimatedMinutes: 30 },
      { title: 'Task C', estimatedMinutes: 45 },
      { title: 'Task D', estimatedMinutes: 120 },
    ]),
  },
}

export const AllCompleted: Story = {
  args: {
    tasks: makeTasks([
      { title: 'Task A', status: 'completed', estimatedMinutes: 60 },
      { title: 'Task B', status: 'completed', estimatedMinutes: 30 },
    ]),
  },
}

export const NoEstimates: Story = {
  args: {
    tasks: makeTasks([
      { title: 'Task A' },
      { title: 'Task B', status: 'completed' },
    ]),
  },
}
