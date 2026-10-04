import { Loader2 } from 'lucide-react'

import { PageEditorInner } from '#components/task/task-page-editor-inner'
import { useTaskPage } from '#hooks/use-task-pages'

export function TaskPageEditor({
  taskId,
  pageId,
}: {
  taskId: string
  pageId: string
}) {
  const { data: page, isLoading } = useTaskPage(taskId, pageId)

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!page) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Page not found</p>
      </div>
    )
  }

  return (
    <PageEditorInner
      key={pageId}
      taskId={taskId}
      pageId={pageId}
      defaultTitle={page.title}
      defaultContent={page.content}
      format={page.format}
    />
  )
}
