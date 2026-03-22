import { createFileRoute, Link } from '@tanstack/react-router'
import { TaskPageEditor } from '@web/components/task/task-page-editor'
import { useTaskPages } from '@web/hooks/use-task-pages'
import { ArrowLeft, Loader2 } from 'lucide-react'

export const Route = createFileRoute('/tasks/$taskId/pages/$pageId')({
  component: TaskPageView,
})

function TaskPageView() {
  const { taskId, pageId } = Route.useParams()

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Link
          to="/tasks/$taskId"
          params={{ taskId }}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <PageTitle taskId={taskId} pageId={pageId} />
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <TaskPageEditor taskId={taskId} pageId={pageId} />
      </div>
    </div>
  )
}

function PageTitle({ taskId, pageId }: { taskId: string; pageId: string }) {
  const { data: pages, isLoading } = useTaskPages(taskId)

  if (isLoading) {
    return <Loader2 className="size-4 animate-spin text-muted-foreground" />
  }

  const page = pages?.find((p) => p.id === pageId)

  if (!page) {
    return <span className="text-muted-foreground">Page not found</span>
  }

  return (
    <span className="text-sm font-medium text-foreground">{page.title}</span>
  )
}
