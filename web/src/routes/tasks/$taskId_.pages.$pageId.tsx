import { createFileRoute } from '@tanstack/react-router'

import { PageBreadcrumb } from '#components/task/page-breadcrumb'
import { TaskPageEditor } from '#components/task/task-page-editor'
import { BackLink } from '#components/ui/back-header-bar'
import { ScreenHeaderBar } from '#components/ui/screen-header-bar'
import { useTaskPage } from '#hooks/use-task-pages'
import { useTask } from '#hooks/use-tasks'

export const Route = createFileRoute('/tasks/$taskId_/pages/$pageId')({
  component: TaskPageView,
})

function TaskPageView() {
  const { taskId, pageId } = Route.useParams()
  const { data: task } = useTask(taskId)
  const { data: page, isLoading } = useTaskPage(taskId, pageId)

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10">
        <ScreenHeaderBar>
          <BackLink to="/tasks/$taskId" params={{ taskId }} aria-label="Back" />
          <PageBreadcrumb
            isLoading={isLoading}
            taskNumber={task?.number}
            page={page}
          />
        </ScreenHeaderBar>
      </div>

      {/* Editor */}
      <div>
        <TaskPageEditor taskId={taskId} pageId={pageId} />
      </div>
    </div>
  )
}
