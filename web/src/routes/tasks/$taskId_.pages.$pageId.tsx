import { createFileRoute, Link } from '@tanstack/react-router'

import { PageBreadcrumb } from '#components/task/page-breadcrumb'
import { TaskPageEditor } from '#components/task/task-page-editor'
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
    <div className="flex h-full flex-col">
      <ScreenHeaderBar>
        <Link
          to="/tasks/$taskId"
          params={{ taskId }}
          className="shrink-0 font-mono text-xs text-muted-foreground-strong hover:text-foreground"
        >
          ←
        </Link>
        <PageBreadcrumb
          isLoading={isLoading}
          taskNumber={task?.number}
          page={page}
        />
      </ScreenHeaderBar>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <TaskPageEditor taskId={taskId} pageId={pageId} />
      </div>
    </div>
  )
}
