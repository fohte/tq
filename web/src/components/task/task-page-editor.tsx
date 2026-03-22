import { MarkdownEditor } from '@web/components/ui/markdown-editor'
import { useTaskPages, useUpdateTaskPage } from '@web/hooks/use-task-pages'
import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

export function TaskPageEditor({
  taskId,
  pageId,
}: {
  taskId: string
  pageId: string
}) {
  const { data: pages, isLoading } = useTaskPages(taskId)
  const page = pages?.find((p) => p.id === pageId)

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
      taskId={taskId}
      pageId={pageId}
      defaultTitle={page.title}
      defaultContent={page.content}
    />
  )
}

function PageEditorInner({
  taskId,
  pageId,
  defaultTitle,
  defaultContent,
}: {
  taskId: string
  pageId: string
  defaultTitle: string
  defaultContent: string
}) {
  const updatePage = useUpdateTaskPage(taskId)
  const [title, setTitle] = useState(defaultTitle)
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSaveRef = useRef<(() => void) | null>(null)
  const titleSavingRef = useRef(false)

  const handleTitleBlur = useCallback(() => {
    if (titleSavingRef.current) {
      titleSavingRef.current = false
      return
    }
    const trimmed = title.trim()
    if (trimmed && trimmed !== defaultTitle) {
      updatePage.mutate({ pageId, input: { title: trimmed } })
    } else {
      setTitle(defaultTitle)
    }
  }, [title, defaultTitle, pageId, updatePage])

  const handleContentChange = useCallback(
    (markdown: string) => {
      if (pendingRef.current) clearTimeout(pendingRef.current)
      const doSave = () => {
        updatePage.mutate({ pageId, input: { content: markdown } })
        pendingSaveRef.current = null
      }
      pendingSaveRef.current = doSave
      pendingRef.current = setTimeout(doSave, 1000)
    },
    [pageId, updatePage],
  )

  useEffect(() => {
    return () => {
      if (pendingRef.current) clearTimeout(pendingRef.current)
      pendingSaveRef.current?.()
    }
  }, [])

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      {/* Editable title */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={handleTitleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            titleSavingRef.current = true
            setTitle(defaultTitle)
            e.currentTarget.blur()
          }
        }}
        className="bg-transparent text-2xl font-bold text-foreground outline-none placeholder:text-muted-foreground"
        placeholder="Page title"
      />

      {/* Content editor */}
      <div className="min-h-[400px] text-sm">
        <MarkdownEditor
          defaultValue={defaultContent}
          placeholder="Write something..."
          onChange={handleContentChange}
        />
      </div>
    </div>
  )
}
