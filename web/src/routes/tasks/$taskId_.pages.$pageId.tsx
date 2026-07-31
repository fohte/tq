import { createFileRoute, Link } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'

import { TaskPageEditor } from '#components/task/task-page-editor'
import { ScreenHeaderBar } from '#components/ui/screen-header-bar'
import { useTaskPage } from '#hooks/use-task-pages'
import { useTask } from '#hooks/use-tasks'

export const Route = createFileRoute('/tasks/$taskId_/pages/$pageId')({
  component: TaskPageView,
})

function TaskPageView() {
  const { taskId, pageId } = Route.useParams()

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
        <PageBreadcrumb taskId={taskId} pageId={pageId} />
      </ScreenHeaderBar>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <TaskPageEditor taskId={taskId} pageId={pageId} />
      </div>
    </div>
  )
}

function PageBreadcrumb({
  taskId,
  pageId,
}: {
  taskId: string
  pageId: string
}) {
  const { data: task } = useTask(taskId)
  const { data: page, isLoading } = useTaskPage(taskId, pageId)

  if (isLoading) {
    return <Loader2 className="size-4 animate-spin text-muted-foreground" />
  }

  if (!page) {
    return (
      <span className="font-mono text-xs text-muted-foreground">
        Page not found
      </span>
    )
  }

  return (
    <>
      {task && (
        <span className="shrink-0 font-mono text-xs text-muted-foreground">
          #{task.number}
        </span>
      )}
      <span className="shrink-0 text-muted-foreground-ghost">/</span>
      <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium text-foreground">
        {page.title}
      </span>
      <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground-ghost">
        saved {formatSavedTime(page.updatedAt)}
      </span>
    </>
  )
}

function formatSavedTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${String(diffMinutes)}m ago`
  if (diffHours < 24) return `${String(diffHours)}h ago`
  if (diffDays < 7) return `${String(diffDays)}d ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
