import { createFileRoute } from '@tanstack/react-router'

import {
  TaskMainContent,
  TaskSidebar,
  TaskSidebarMobile,
} from '#components/task/task-detail'
import { FullPageLoading } from '#components/ui/full-page-loading'
import { FullPageMessage } from '#components/ui/full-page-message'
import { useSyncTaskGithubLink } from '#hooks/use-github-link'
import { useTask } from '#hooks/use-tasks'

export const Route = createFileRoute('/tasks/$taskId')({
  component: TaskPage,
})

function TaskPage() {
  const { taskId } = Route.useParams()
  const { data: task, isLoading, error } = useTask(taskId)
  useSyncTaskGithubLink(taskId, task?.githubLink != null)

  if (isLoading) {
    return <FullPageLoading />
  }

  if (error || !task) {
    return <FullPageMessage>Task not found</FullPageMessage>
  }

  return (
    <>
      {/* PC layout */}
      <div className="hidden h-full md:flex">
        <div className="flex-1 overflow-y-auto px-7 py-6">
          <TaskMainContent task={task} />
        </div>
        <TaskSidebar task={task} />
      </div>

      {/* SP layout */}
      <div className="flex h-full flex-col overflow-y-auto p-4 md:hidden">
        <TaskSidebarMobile task={task} />
        <div className="mt-4 border-t border-border pt-4">
          <TaskMainContent task={task} />
        </div>
      </div>
    </>
  )
}
