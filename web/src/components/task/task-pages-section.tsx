import { Button } from '@fohte/ui/button'
import { Loader2, Plus } from 'lucide-react'
import { useState } from 'react'

import { PageCardPresentation } from '#components/task/page-card'
import { HtmlPageEditor } from '#components/ui/html-page-editor'
import { MarkdownEditor } from '#components/ui/markdown-editor'
import { SectionHeading } from '#components/ui/section-heading'
import { SectionLoadingIndicator } from '#components/ui/section-loading-indicator'
import { useDebouncedSave } from '#hooks/use-debounced-save'
import type { TaskPage } from '#hooks/use-task-pages'
import {
  useCreateTaskPage,
  useDeleteTaskPage,
  useTaskPage,
  useTaskPages,
  useUpdateTaskPage,
} from '#hooks/use-task-pages'

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
  const [isExpanded, setIsExpanded] = useState(false)
  const deletePage = useDeleteTaskPage(taskId)
  const { data: expandedPage, isError: isContentLoadError } = useTaskPage(
    taskId,
    page.id,
    isExpanded,
  )

  return (
    <PageCardPresentation
      taskId={taskId}
      page={page}
      isExpanded={isExpanded}
      onExpandedChange={setIsExpanded}
      expandedContent={expandedPage?.content}
      contentLoadError={expandedPage === undefined && isContentLoadError}
      onDelete={() => {
        deletePage.mutate(page.id)
      }}
      isDeleting={deletePage.isPending}
      renderEditor={(defaultValue, { editing, onEditingChange }) => (
        <PageInlineEditor
          taskId={taskId}
          pageId={page.id}
          format={expandedPage?.format ?? page.format}
          defaultValue={defaultValue}
          editing={editing}
          onEditingChange={onEditingChange}
        />
      )}
    />
  )
}

// --- Inline Editor ---

function PageInlineEditor({
  taskId,
  pageId,
  format,
  defaultValue,
  editing,
  onEditingChange,
}: {
  taskId: string
  pageId: string
  format: TaskPage['format']
  defaultValue: string
  editing: boolean
  onEditingChange: (editing: boolean) => void
}) {
  const updatePage = useUpdateTaskPage(taskId)
  const { onChange, flush } = useDebouncedSave((content) => {
    updatePage.mutate({ pageId, input: { content } })
  })

  if (format === 'html') {
    return (
      <div className="text-sm">
        <HtmlPageEditor
          defaultValue={defaultValue}
          placeholder="Write HTML..."
          onChange={onChange}
          onExitSourceMode={flush}
        />
      </div>
    )
  }

  return (
    <div className="text-sm">
      <MarkdownEditor
        defaultValue={defaultValue}
        placeholder="Write something..."
        editing={editing}
        onEditingChange={onEditingChange}
        onChange={onChange}
        onExitEditMode={flush}
        size="compact"
      />
    </div>
  )
}
