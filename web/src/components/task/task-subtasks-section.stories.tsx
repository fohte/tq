import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { makeTask } from '#components/task/task-row-test-fixtures'
import type { InheritedTaskAttributes } from '#components/task/task-subtasks-section'
import { TaskSubtasksList } from '#components/task/task-subtasks-section'
import type { Task } from '#hooks/use-tasks'
import { StoryRouter } from '#storybook-config/story-router'

const parentTaskId = '00000000-0000-0000-0000-000000000001'
const parentTaskTitle = 'Design the new dashboard'

const baseSubtask: Task = makeTask({
  id: '00000000-0000-0000-0000-000000000011',
  number: 11,
  title: 'Sketch wireframes',
  context: 'work',
  estimatedMinutes: 30,
  parentId: parentTaskId,
  parentNumber: 1,
})

const mixedSubtasks: Task[] = [
  {
    ...baseSubtask,
    id: '00000000-0000-0000-0000-000000000011',
    number: 11,
    title: 'Sketch wireframes',
    status: 'completed',
    estimatedMinutes: 30,
  },
  {
    ...baseSubtask,
    id: '00000000-0000-0000-0000-000000000012',
    number: 12,
    title: 'Get feedback from the team',
    status: 'todo',
    estimatedMinutes: 15,
  },
  {
    ...baseSubtask,
    id: '00000000-0000-0000-0000-000000000013',
    number: 13,
    title: 'Finalize the design',
    status: 'todo',
    estimatedMinutes: null,
  },
]

const allCompletedSubtasks: Task[] = mixedSubtasks.map((subtask) => ({
  ...subtask,
  status: 'completed',
}))

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => <>{children}</>}
        paths={['/tasks/$taskId']}
      />
    </QueryClientProvider>
  )
}

function SectionStory({
  subtasks,
  inherited,
  parentTaskTitle,
}: {
  subtasks: Task[]
  inherited: InheritedTaskAttributes
  parentTaskTitle: string
}) {
  return (
    <Providers>
      <div className="max-w-2xl p-6">
        <TaskSubtasksList
          taskId={parentTaskId}
          parentTaskNumber={1}
          parentTaskTitle={parentTaskTitle}
          subtasks={subtasks}
          inherited={inherited}
        />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/Subtasks/Section',
  component: SectionStory,
  parameters: {
    layout: 'padded',
  },
  args: {
    inherited: { context: 'work', projectId: null, labels: [] },
    parentTaskTitle,
  },
} satisfies Meta<typeof SectionStory>

export default meta
type SectionStoryType = StoryObj<typeof meta>

export const Default: SectionStoryType = {
  name: 'a parent task lists active and completed subtasks',
  args: { subtasks: mixedSubtasks },
}

export const AllCompleted: SectionStoryType = {
  name: 'the parent task has only completed subtasks',
  args: { subtasks: allCompletedSubtasks },
}

export const Empty: SectionStoryType = {
  name: 'the parent task has no subtasks yet',
  args: { subtasks: [] },
}
