import { Link } from '@tanstack/react-router'
import { ChevronDown, Code2, ExternalLink, Loader2, Plus } from 'lucide-react'
import { useState } from 'react'

import { LlmAuthorLabel } from '#components/task/llm-author-label'
import { Button } from '#components/ui/button'
import { DeleteConfirmButton } from '#components/ui/delete-confirm-button'
import { HtmlPageEditor } from '#components/ui/html-page-editor'
import { MarkdownEditor } from '#components/ui/markdown-editor'
import { Panel } from '#components/ui/panel'
import { SectionHeading } from '#components/ui/section-heading'
import { SectionLoadingIndicator } from '#components/ui/section-loading-indicator'
import { useDebouncedSave } from '#hooks/use-debounced-save'
import type { TaskPage } from '#hooks/use-task-pages'
import {
  useCreateTaskPage,
  useDeleteTaskPage,
  useTaskPages,
  useUpdateTaskPage,
} from '#hooks/use-task-pages'
import { formatRelativeTime } from '#lib/format'
import { cn } from '#lib/utils'

// --- Pages Section (in task detail) ---

export function TaskPagesSection({ taskId }: { taskId: string }) {
  const { data: pages, isLoading } = useTaskPages(taskId)
  const createPage = useCreateTaskPage(taskId)

  const handleAddPage = () => {
    createPage.mutate({ title: 'Untitled' })
  }

  if (isLoading) {
    return <SectionLoadingIndicator label="pages" />
  }

  return (
    <PagesSectionHeader
      pages={pages ?? []}
      taskId={taskId}
      onAddPage={handleAddPage}
      isAddingPage={createPage.isPending}
    />
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
    <PagesSectionHeader
      pages={pages}
      taskId={taskId}
      onAddPage={onAddPage}
      isAddingPage={isAddingPage}
    />
  )
}

function PagesSectionHeader({
  taskId,
  pages,
  onAddPage,
  isAddingPage,
}: {
  taskId: string
  pages: TaskPage[]
  onAddPage?: (() => void) | undefined
  isAddingPage?: boolean | undefined
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline gap-2">
        <SectionHeading level={3}>pages</SectionHeading>
        <span className="font-mono text-2xs text-muted-foreground-faint">
          {pages.length}
        </span>
        {onAddPage && (
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="ml-auto"
            onClick={onAddPage}
            disabled={isAddingPage}
          >
            {isAddingPage === true ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Plus className="size-3" />
            )}
            add page
          </Button>
        )}
      </div>

      {pages.length > 0 ? (
        <div className="flex flex-col gap-2">
          {pages.map((page) => (
            <PageCard key={page.id} taskId={taskId} page={page} />
          ))}
        </div>
      ) : (
        <p className="font-mono text-xs text-muted-foreground">
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
      onDelete={() => {
        deletePage.mutate(page.id)
      }}
      isDeleting={deletePage.isPending}
      renderEditor={(defaultValue) => (
        <PageInlineEditor
          taskId={taskId}
          pageId={page.id}
          format={page.format}
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

  const previewLines =
    page.format === 'html' ? null : getPreviewLines(page.content, 3)
  const hasMore =
    page.format !== 'html' &&
    page.content.split('\n').filter((line) => line.trim()).length > 3

  return (
    <Panel>
      {/* Header */}
      <div className="flex items-center gap-2 px-2.5 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => {
            setInternalExpanded(!isExpanded)
          }}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          <ChevronDown
            className={cn(
              'size-3.5 transition-transform',
              !isExpanded && '-rotate-90',
            )}
          />
        </Button>
        <button
          type="button"
          onClick={() => {
            setInternalExpanded(!isExpanded)
          }}
          className="flex flex-1 items-center gap-2 overflow-hidden text-left"
        >
          <span className="truncate font-mono text-xs font-medium text-foreground">
            {page.title}
          </span>
          <LlmAuthorLabel author={page.author} />
        </button>

        <span className="shrink-0 font-mono text-2xs text-muted-foreground-ghost">
          {formatRelativeTime(page.updatedAt)}
        </span>

        <div className="flex shrink-0 items-center gap-1">
          <Link
            to="/tasks/$taskId/pages/$pageId"
            params={{ taskId, pageId: page.id }}
            className="flex size-6 items-center justify-center text-muted-foreground-faint transition-colors hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation()
            }}
            aria-label="Open page"
          >
            <ExternalLink className="size-3.5" />
          </Link>
          <DeleteConfirmButton
            title="Delete page"
            description={`Are you sure you want to delete "${page.title}"? This action cannot be undone.`}
            onDelete={() => onDelete?.()}
            disabled={isDeleting}
            open={deleteDialogOpen}
            iconClassName="size-3.5"
          />
        </div>
      </div>

      {/* Preview (collapsed) */}
      {!isExpanded && page.format === 'html' && (
        <div className="flex items-center gap-1.5 border-t border-border px-2.5 py-2 font-mono text-2xs text-muted-foreground-faint">
          <Code2 className="size-3" />
          <span>HTML page</span>
        </div>
      )}
      {!isExpanded && previewLines != null && (
        <div className="flex flex-col gap-1.5 border-t border-border px-2.5 py-2">
          <p className="line-clamp-3 whitespace-pre-line font-editor text-xs text-muted-foreground">
            {previewLines}
          </p>
          {hasMore && (
            <Button
              type="button"
              variant="link"
              size="xs"
              className="h-auto w-fit p-0 text-2xs"
              onClick={() => {
                setInternalExpanded(true)
              }}
            >
              show more
            </Button>
          )}
        </div>
      )}

      {/* Expanded editor */}
      {isExpanded && renderEditor && (
        <div className="border-t border-border bg-card p-3">
          {renderEditor(page.content)}
        </div>
      )}
    </Panel>
  )
}

// --- Inline Editor ---

function PageInlineEditor({
  taskId,
  pageId,
  format,
  defaultValue,
}: {
  taskId: string
  pageId: string
  format: TaskPage['format']
  defaultValue: string
}) {
  const updatePage = useUpdateTaskPage(taskId)
  const { onChange, flush } = useDebouncedSave((content) => {
    updatePage.mutate({ pageId, input: { content } })
  })

  if (format === 'html') {
    return (
      <div className="h-[400px] text-sm">
        <HtmlPageEditor
          defaultValue={defaultValue}
          placeholder="Write HTML..."
          onChange={onChange}
          onExitSourceMode={flush}
          className="h-full"
        />
      </div>
    )
  }

  return (
    <div className="min-h-[80px] text-sm">
      <MarkdownEditor
        defaultValue={defaultValue}
        placeholder="Write something..."
        onChange={onChange}
        viewEditToggle={{ onExitEditMode: flush }}
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
