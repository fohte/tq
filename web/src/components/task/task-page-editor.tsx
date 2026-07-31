import { Link } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Input } from '#components/ui/input'
import { MarkdownEditor } from '#components/ui/markdown-editor'
import { ScreenHeaderBar } from '#components/ui/screen-header-bar'
import {
  DEBOUNCED_SAVE_DELAY_MS,
  useDebouncedSave,
} from '#hooks/use-debounced-save'
import { useTaskPage, useUpdateTaskPage } from '#hooks/use-task-pages'

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
    />
  )
}

export function PageEditorInner({
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
  const titleSavingRef = useRef(false)

  useEffect(() => {
    setTitle(defaultTitle)
  }, [defaultTitle])

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

  const { onChange: handleContentChange } = useDebouncedSave((markdown) => {
    updatePage.mutate({ pageId, input: { content: markdown } })
  })

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3.5 p-6">
      {/* Editable title */}
      <Input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value)
        }}
        onBlur={handleTitleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            titleSavingRef.current = true
            setTitle(defaultTitle)
            e.currentTarget.blur()
          }
        }}
        className="h-auto border-0 bg-transparent p-0 text-2xl font-bold text-foreground shadow-none outline-none focus-visible:border-0 focus-visible:ring-0 md:text-2xl"
        placeholder="Page title"
      />

      {/* Meta line */}
      <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground-faint">
        <span>MARKDOWN</span>
        <span className="text-border">|</span>
        <span>autosave {DEBOUNCED_SAVE_DELAY_MS / 1000}s</span>
      </div>

      {/* Content editor */}
      <div className="min-h-[400px] border border-border bg-card p-2.5 text-sm">
        <MarkdownEditor
          defaultValue={defaultContent}
          placeholder="Write something..."
          onChange={handleContentChange}
        />
      </div>
    </div>
  )
}

// --- Subpage View (header + editor, for Storybook) ---

export function SubpageViewPresentation({
  taskId,
  pageTitle,
  children,
}: {
  taskId: string
  pageTitle: string
  children: React.ReactNode
}) {
  return (
    <div className="flex h-full flex-col">
      <ScreenHeaderBar>
        <Link
          to="/tasks/$taskId"
          params={{ taskId }}
          className="font-mono text-xs text-muted-foreground-strong hover:text-foreground"
        >
          ←
        </Link>
        <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium text-foreground">
          {pageTitle}
        </span>
      </ScreenHeaderBar>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
