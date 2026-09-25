import type { Meta, StoryObj } from '@storybook/react-vite'

import { TaskListHeader } from '#components/task/task-list-header'
import { makeTask } from '#components/task/task-row-test-fixtures'
import type { Task } from '#hooks/use-tasks'

const makeTasks = (overrides: Array<Partial<Task>>): Task[] =>
  overrides.map((o, i) =>
    makeTask({
      id: `00000000-0000-0000-0000-00000000000${String(i)}`,
      number: i + 1,
      ...o,
    }),
  )

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
  name: 'the progress header shows zero completed tasks.',
  args: {
    tasks: [],
  },
}

export const NoneCompleted: Story = {
  name: 'the header shows estimated time with no tasks completed.',
  args: {
    tasks: makeTasks([
      { title: 'Task A', estimatedMinutes: 60 },
      { title: 'Task B', estimatedMinutes: 30 },
      { title: 'Task C', estimatedMinutes: 45 },
    ]),
  },
}

export const PartiallyCompleted: Story = {
  name: 'the header shows partial completion and estimated time.',
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
  name: 'the header shows every task completed.',
  args: {
    tasks: makeTasks([
      { title: 'Task A', status: 'completed', estimatedMinutes: 60 },
      { title: 'Task B', status: 'completed', estimatedMinutes: 30 },
    ]),
  },
}

export const NoEstimates: Story = {
  name: 'the header omits estimated time when tasks have no estimates.',
  args: {
    tasks: makeTasks([
      { title: 'Task A' },
      { title: 'Task B', status: 'completed' },
    ]),
  },
}
