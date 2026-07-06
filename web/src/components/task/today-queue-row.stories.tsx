import { closestCenter, DndContext } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { TodayQueueRow } from '@web/components/task/today-queue-row'
import type { Task } from '@web/hooks/use-tasks'
import { fn } from 'storybook/test'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    title: 'Write the quarterly report',
    description: null,
    status: 'todo',
    context: 'work',
    startDate: null,
    dueDate: null,
    estimatedMinutes: 30,
    parentId: null,
    projectId: null,
    sortOrder: 0,
    recurrenceRuleId: null,
    recurrenceRule: null,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    activeTimeBlockStartTime: null,
    ...overrides,
  }
}

const meta = {
  title: 'Task/TodayQueueRow',
  component: TodayQueueRow,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="w-96">
        <DndContext collisionDetection={closestCenter}>
          <SortableContext
            items={['00000000-0000-0000-0000-000000000001']}
            strategy={verticalListSortingStrategy}
          >
            <Story />
          </SortableContext>
        </DndContext>
      </div>
    ),
  ],
  args: {
    onRemove: fn(),
  },
} satisfies Meta<typeof TodayQueueRow>

export default meta
type Story = StoryObj<typeof meta>

export const WithEstimate: Story = {
  args: {
    task: makeTask(),
  },
}

export const MissingEstimate: Story = {
  args: {
    task: makeTask({ estimatedMinutes: null, title: 'Plan the launch' }),
  },
}

export const InProgress: Story = {
  args: {
    task: makeTask({ status: 'in_progress' }),
  },
}
