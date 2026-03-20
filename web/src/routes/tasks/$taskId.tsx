import { createFileRoute } from '@tanstack/react-router'
import {
  TaskMainContent,
  TaskSidebar,
  TaskSidebarMobile,
} from '@web/components/task/task-detail'
import { useTask } from '@web/hooks/use-tasks'
import { Loader2 } from 'lucide-react'

export const Route = createFileRoute('/tasks/$taskId')({
  component: TaskPage,
})

function TaskPage() {
  const { taskId } = Route.useParams()
  const { data: task, isLoading, error } = useTask(taskId)

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !task) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Task not found</p>
      </div>
    )
  }

  return (
    <>
      {/* PC layout */}
      <div className="hidden h-full md:flex">
        <div className="flex-1 overflow-y-auto p-6">
          <TaskMainContent task={task} />
        </div>
        <div className="w-60 shrink-0 overflow-y-auto border-l border-border p-4">
          <TaskSidebar task={task} />
        </div>
      </div>

      {/* SP layout */}
      <div className="flex h-full flex-col overflow-y-auto md:hidden">
        <div className="p-4">
          <TaskMainContent task={task} />
        </div>
        <div className="border-t border-border p-4">
          <TaskSidebarMobile task={task} />
        </div>
      </div>
    </>
  )
}
