import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { expect, within } from 'storybook/test'

import { makeTask } from '#components/task/task-row-test-fixtures'
import type { InheritedTaskAttributes } from '#components/task/task-subtasks-section'
import { TaskSubtasksList } from '#components/task/task-subtasks-section'
import type { Task } from '#hooks/use-tasks'
import { emptyLabelsHandler } from '#lib/msw-test-handlers'
import { assertDefined } from '#lib/test-utils'
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
  args: { subtasks: mixedSubtasks },
}

export const AllCompleted: SectionStoryType = {
  args: { subtasks: allCompletedSubtasks },
}

export const Empty: SectionStoryType = {
  args: { subtasks: [] },
}

export const AddingSubtask: SectionStoryType = {
  args: {
    subtasks: mixedSubtasks,
    inherited: {
      context: 'work',
      projectId: 'aaaa0000-0000-0000-0000-000000000000',
      labels: ['dev:tq'],
    },
  },
  parameters: {
    msw: { handlers: [emptyLabelsHandler] },
  },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)

    const addButton = await canvas.findByRole('button', {
      name: /add subtask/i,
    })
    await userEvent.click(addButton)

    // The modal renders via a portal to document.body, not inside canvasElement.
    const body = within(canvasElement.ownerDocument.body)
    await expect(
      (await body.findAllByPlaceholderText(/task title|タスクのタイトル/i))
        .length,
    ).toBeGreaterThan(0)

    // Parent indicator shows the subtask-of task.
    await expect(
      body.getAllByText(/subtask of #1 Design the new dashboard/).length,
    ).toBeGreaterThan(0)

    // Inherited context lands as the Context select's initial value. Base
    // UI's SelectValue only resolves "work" to its "Work" label once an item
    // has registered, which happens on first open — so open it here. The
    // Context trigger is the only select-trigger not showing its placeholder
    // (Commitment has no default, so it still shows "Inbox").
    const contextTrigger = assertDefined(
      canvasElement.ownerDocument.body.querySelector<HTMLElement>(
        '[data-slot="select-trigger"]:not([data-placeholder])',
      ),
    )
    await userEvent.click(contextTrigger)
    await expect((await body.findAllByText('Work')).length).toBeGreaterThan(0)

    // Inherited label lands as a tag chip.
    await expect(body.getAllByText(/dev:tq/).length).toBeGreaterThan(0)
  },
}
