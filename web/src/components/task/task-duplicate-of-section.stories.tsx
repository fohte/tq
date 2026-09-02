import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { TaskDuplicateOfSection } from '#components/task/task-duplicate-of-section'
import { makeTask } from '#components/task/task-row-test-fixtures'
import type { LinkedTaskSummary } from '#hooks/use-tasks'
import { StoryRouter } from '#storybook-config/story-router'

const duplicateOfTask: LinkedTaskSummary = makeTask({
  id: 'task-001',
  number: 12,
  title: 'Design the schema',
  context: 'work',
})

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
  duplicateOfTask,
}: {
  duplicateOfTask: LinkedTaskSummary | null
}) {
  return (
    <Providers>
      <div className="max-w-2xl border border-border bg-background p-6">
        <TaskDuplicateOfSection duplicateOfTask={duplicateOfTask} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/TaskDuplicateOfSection',
  component: SectionStory,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof SectionStory>

export default meta
type Story = StoryObj<typeof meta>

export const WithDuplicateOfTask: Story = {
  args: { duplicateOfTask },
}

export const Empty: Story = {
  args: { duplicateOfTask: null },
}
