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
  useSyncTaskGithubLink(taskId, (task?.githubLinks.length ?? 0) > 0)

  if (isLoading) {
    return <FullPageLoading />
  }

  if (error || !task) {
    return <FullPageMessage>Task not found</FullPageMessage>
  }

  return (
    <>
      {/* PC layout */}
      <div className="hidden md:flex">
        <div className="flex-1 px-7 py-6">
          <TaskMainContent task={task} />
        </div>
        <TaskSidebar task={task} />
      </div>

      {/* SP layout */}
      <div className="flex flex-col p-4 md:hidden">
        <TaskSidebarMobile task={task} />
        <div className="mt-4 border-t border-border pt-4">
          <TaskMainContent task={task} />
        </div>
      </div>
    </>
  )
}
