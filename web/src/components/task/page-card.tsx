import { Button } from '@fohte/ui/button'
import { Panel } from '@fohte/ui/panel'
import { Link } from '@tanstack/react-router'
import { ChevronDown, Code2, ExternalLink, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { LlmAuthorLabel } from '#components/task/llm-author-label'
import { ActionsMenu } from '#components/ui/actions-menu'
import { DeleteConfirmDialog } from '#components/ui/delete-confirm-dialog'
import type { TaskPage } from '#hooks/use-task-pages'
import { formatRelativeTime } from '#lib/format'
import { cn } from '#lib/utils'

export function PageCardPresentation({
  taskId,
  page,
  onDelete,
  isDeleting,
  isExpanded: controlledExpanded,
  defaultEditing = false,
  defaultActionsMenuOpen,
  deleteDialogOpen,
  renderEditor,
}: {
  taskId: string
  page: TaskPage
  onDelete?: () => void
  isDeleting?: boolean
  isExpanded?: boolean
  defaultEditing?: boolean
  defaultActionsMenuOpen?: 'desktop' | 'mobile' | undefined
  deleteDialogOpen?: boolean
  renderEditor?: (
    defaultValue: string,
    options: {
      editing: boolean
      onEditingChange: (editing: boolean) => void
    },
  ) => React.ReactNode
}) {
  const [internalExpanded, setInternalExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(defaultEditing)
  const [internalDeleteDialogOpen, setInternalDeleteDialogOpen] =
    useState(false)
  const isExpanded = controlledExpanded ?? internalExpanded

  const previewLines =
    page.format === 'html' ? null : getPreviewLines(page.content, 3)
  const hasMore =
    page.format !== 'html' &&
    page.content.split('\n').filter((line) => line.trim()).length > 3
  const actionItems = [
    ...(page.format === 'markdown'
      ? [
          {
            icon: <Pencil className="h-4 w-4" />,
            label: 'edit',
            onClick: () => {
              setInternalExpanded(true)
              setIsEditing(true)
            },
          },
        ]
      : []),
    ...(isDeleting !== true
      ? [
          {
            icon: <Trash2 className="h-4 w-4" />,
            label: 'delete…',
            onClick: () => {
              setInternalDeleteDialogOpen(true)
            },
            destructive: true,
          },
        ]
      : []),
  ]

  return (
    <Panel padding="none">
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
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setInternalExpanded(!isExpanded)
          }}
          className="h-auto min-h-0 justify-start rounded-none border-0 bg-transparent p-0 font-normal shadow-none transition-none hover:bg-transparent active:translate-y-0 flex flex-1 items-center gap-2 overflow-hidden text-left"
        >
          <span className="truncate font-mono text-xs font-medium text-foreground">
            {page.title}
          </span>
          <LlmAuthorLabel author={page.author} />
        </Button>

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
          {actionItems.length > 0 && (
            <ActionsMenu
              aria-label="Page actions"
              defaultOpen={defaultActionsMenuOpen}
              items={actionItems}
            />
          )}
        </div>
      </div>

      <DeleteConfirmDialog
        title="Delete page"
        description={`Are you sure you want to delete "${page.title}"? This action cannot be undone.`}
        onConfirm={() => onDelete?.()}
        open={deleteDialogOpen ?? internalDeleteDialogOpen}
        onOpenChange={setInternalDeleteDialogOpen}
      />

      {/* Preview (collapsed) */}
      {!isExpanded && page.format === 'html' && (
        <div className="flex items-center gap-1.5 border-t border-border px-2.5 py-2 font-mono text-2xs text-muted-foreground-faint">
          <Code2 className="size-3" />
          <span>HTML page</span>
        </div>
      )}
      {!isExpanded && previewLines != null && (
        <div className="flex flex-col gap-1.5 border-t border-border px-2.5 py-2">
          <p className="line-clamp-3 whitespace-pre-line font-code text-xs text-muted-foreground">
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
          {renderEditor(page.content, {
            editing: isEditing,
            onEditingChange: setIsEditing,
          })}
        </div>
      )}
    </Panel>
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
