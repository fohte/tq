import type { Meta, StoryObj } from '@storybook/react-vite'

import { TaskSidebarMobile } from '#components/task/task-detail-sidebar'
import { makeTaskDetail } from '#components/task/task-row-test-fixtures'
import { TaskSidebarStoryProviders } from '#components/task/task-sidebar-story-providers'
import type { TaskDetail } from '#hooks/use-tasks'

function MobileSidebarStory({ task }: { task: TaskDetail }) {
  return (
    <TaskSidebarStoryProviders task={task}>
      <div className="max-w-sm border-t border-border p-4">
        <TaskSidebarMobile task={task} />
      </div>
    </TaskSidebarStoryProviders>
  )
}

const meta = {
  title: 'Task/TaskDetail/Sidebar',
  component: MobileSidebarStory,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof MobileSidebarStory>

export default meta
type Story = StoryObj<typeof meta>

export const MobileSidebar: Story = {
  name: 'task details appear in the compact mobile sidebar',
  args: {
    task: makeTaskDetail(),
  },
}

export const MobileSidebarWithChecklistProgress: Story = {
  name: 'the mobile sidebar shows checklist progress',
  args: {
    task: makeTaskDetail({
      checklistCompletionCount: { completed: 1, total: 4 },
    }),
  },
}
