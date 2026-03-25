import { Link } from '@tanstack/react-router'
import { DeleteConfirmButton } from '@web/components/ui/delete-confirm-button'
import { MarkdownEditor } from '@web/components/ui/markdown-editor'
import type { TaskPage } from '@web/hooks/use-task-pages'
import {
  useCreateTaskPage,
  useDeleteTaskPage,
  useTaskPages,
  useUpdateTaskPage,
} from '@web/hooks/use-task-pages'
import { cn } from '@web/lib/utils'
import {
  ChevronDown,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

// --- Pages Section (in task detail) ---

export function TaskPagesSection({ taskId }: { taskId: string }) {
  const { data: pages, isLoading } = useTaskPages(taskId)
  const createPage = useCreateTaskPage(taskId)

  const handleAddPage = () => {
    createPage.mutate({ title: 'Untitled' })
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading pages...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <FileText className="size-3.5" />
          Pages
        </h3>
        <button
          type="button"
          onClick={handleAddPage}
          disabled={createPage.isPending}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {createPage.isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Plus className="size-3" />
          )}
          Add page
        </button>
      </div>

      {pages && pages.length > 0 ? (
        <div className="flex flex-col gap-2">
          {pages.map((page) => (
            <PageCard key={page.id} taskId={taskId} page={page} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No pages yet. Add a page to keep notes and documentation.
        </p>
      )}
    </div>
  )
}

// --- Pages List (pure presentation, for Storybook) ---

export function TaskPagesList({
  taskId,
  pages,
  onAddPage,
  isAddingPage,
}: {
  taskId: string
  pages: TaskPage[]
  onAddPage?: () => void
  isAddingPage?: boolean
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <FileText className="size-3.5" />
          Pages
        </h3>
        {onAddPage && (
          <button
            type="button"
            onClick={onAddPage}
            disabled={isAddingPage}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {isAddingPage ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Plus className="size-3" />
            )}
            Add page
          </button>
        )}
      </div>

      {pages.length > 0 ? (
        <div className="flex flex-col gap-2">
          {pages.map((page) => (
            <PageCard key={page.id} taskId={taskId} page={page} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No pages yet. Add a page to keep notes and documentation.
        </p>
      )}
    </div>
  )
}

// --- Page Card (collapsible preview) ---

function PageCard({ taskId, page }: { taskId: string; page: TaskPage }) {
  const deletePage = useDeleteTaskPage(taskId)

  return (
    <PageCardPresentation
      taskId={taskId}
      page={page}
      onDelete={() => deletePage.mutate(page.id)}
      isDeleting={deletePage.isPending}
      renderEditor={(defaultValue) => (
        <PageInlineEditor
          taskId={taskId}
          pageId={page.id}
          defaultValue={defaultValue}
        />
      )}
    />
  )
}

export function PageCardPresentation({
  taskId,
  page,
  onDelete,
  isDeleting,
  isExpanded: controlledExpanded,
  deleteDialogOpen,
  renderEditor,
}: {
  taskId: string
  page: TaskPage
  onDelete?: () => void
  isDeleting?: boolean
  isExpanded?: boolean
  deleteDialogOpen?: boolean
  renderEditor?: (defaultValue: string) => React.ReactNode
}) {
  const [internalExpanded, setInternalExpanded] = useState(false)
  const isExpanded = controlledExpanded ?? internalExpanded

  const previewLines = getPreviewLines(page.content, 3)

  return (
    <div className="rounded-lg border border-border">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setInternalExpanded(!isExpanded)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground transition-transform',
              !isExpanded && '-rotate-90',
            )}
          />
          <span className="truncate text-sm font-medium">{page.title}</span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <Link
            to="/tasks/$taskId/pages/$pageId"
            params={{ taskId, pageId: page.id }}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="size-3.5" />
          </Link>
          <DeleteConfirmButton
            title="Delete page"
            description={`Are you sure you want to delete "${page.title}"? This action cannot be undone.`}
            onDelete={() => onDelete?.()}
            disabled={isDeleting}
            open={deleteDialogOpen}
          />
        </div>
      </div>

      {/* Preview (collapsed) */}
      {!isExpanded && previewLines && (
        <div className="border-t border-border px-3 py-2">
          <p className="line-clamp-3 text-xs text-muted-foreground">
            {previewLines}
          </p>
          {page.content.split('\n').filter((line) => line.trim()).length >
            3 && (
            <button
              type="button"
              onClick={() => setInternalExpanded(true)}
              className="mt-1 text-xs text-primary hover:underline"
            >
              Show more
            </button>
          )}
        </div>
      )}

      {/* Expanded editor */}
      {isExpanded && renderEditor && (
        <div className="border-t border-border p-1">
          {renderEditor(page.content)}
        </div>
      )}
    </div>
  )
}

// --- Inline Editor ---

function PageInlineEditor({
  taskId,
  pageId,
  defaultValue,
}: {
  taskId: string
  pageId: string
  defaultValue: string
}) {
  const updatePage = useUpdateTaskPage(taskId)
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSaveRef = useRef<(() => void) | null>(null)

  const handleChange = useCallback(
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
    <div className="min-h-[80px] text-sm">
      <MarkdownEditor
        defaultValue={defaultValue}
        placeholder="Write something..."
        onChange={handleChange}
      />
    </div>
  )
}

// --- Helpers ---

function getPreviewLines(content: string, maxLines: number): string | null {
  if (!content.trim()) return null
  const lines = content
    .split('\n')
    .filter((line) => line.trim())
    .slice(0, maxLines)
  return lines.join('\n')
}
