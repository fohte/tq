import { Pencil, Trash2 } from 'lucide-react'
import { useCallback, useState } from 'react'

import { ActionsMenu } from '#components/ui/actions-menu'
import { DeleteConfirmDialog } from '#components/ui/delete-confirm-dialog'
import { MarkdownEditor } from '#components/ui/markdown-editor'
import { useDebouncedSave } from '#hooks/use-debounced-save'
import type { Comment } from '#hooks/use-task-comments'
import { useDeleteComment, useUpdateComment } from '#hooks/use-task-comments'
import { formatRelativeTime } from '#lib/format'
import { cn } from '#lib/utils'

type ActivityAuthor = Comment['author']

// tq is a single-user tool, so authors carry a role (human/llm/system) rather
// than a name. Missing data (e.g. comments created before authors were
// tracked) falls back to a neutral placeholder instead of a blank.
export function formatWho(author: ActivityAuthor | null): string {
  if (!author) return 'someone'
  if (author.kind === 'human') return 'you'
  if (author.kind === 'system') return 'system'
  return author.agent ?? 'someone'
}

export function ActivityHeader({
  who,
  what,
  when,
  className,
}: {
  who: string
  what: string
  when: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-baseline gap-2 font-mono text-2xs text-muted-foreground',
        className,
      )}
    >
      <span className="text-muted-foreground-strong">{who}</span>
      <span>{what}</span>
      <span className="ml-auto text-muted-foreground-ghost">{when}</span>
    </div>
  )
}

export function CommentRow({
  taskId,
  comment,
  initiallyEditing = false,
  defaultMenuOpen,
}: {
  taskId: string
  comment: Comment
  initiallyEditing?: boolean
  defaultMenuOpen?: 'desktop' | 'mobile' | undefined
}) {
  const [editing, setEditing] = useState(initiallyEditing)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const updateComment = useUpdateComment(taskId)
  const deleteComment = useDeleteComment(taskId)
  const { onChange, cancel, flush } = useDebouncedSave((markdown) => {
    const trimmed = markdown.trim()
    if (trimmed) {
      updateComment.mutate({ commentId: comment.id, content: trimmed })
    }
  })

  const handleDelete = useCallback(() => {
    cancel()
    deleteComment.mutate(comment.id)
  }, [cancel, comment.id, deleteComment])

  const handleRequestDelete = useCallback(() => {
    cancel()
    setDeleteDialogOpen(true)
  }, [cancel])

  const isEdited = comment.createdAt !== comment.updatedAt

  return (
    <div className="grid grid-cols-(--icon-content-columns) gap-3">
      <span className="pt-px font-mono text-2xs text-muted-foreground-ghost">
        &rsaquo;
      </span>

      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <ActivityHeader
            className="min-w-0 flex-1"
            who={formatWho(comment.author)}
            what={isEdited ? 'commented (edited)' : 'commented'}
            when={formatRelativeTime(comment.createdAt)}
          />

          <ActionsMenu
            aria-label="Comment actions"
            defaultOpen={defaultMenuOpen}
            items={[
              {
                icon: <Pencil className="h-4 w-4" />,
                label: 'Edit',
                onClick: () => {
                  setEditing(true)
                },
              },
              {
                icon: <Trash2 className="h-4 w-4" />,
                label: 'Delete',
                onClick: handleRequestDelete,
                destructive: true,
              },
            ]}
          />
        </div>

        {/* Body - inline editable with debounced auto-save */}
        <div className="border-l-3 border-l-primary bg-card p-2.5 text-sm leading-relaxed text-muted-foreground">
          <MarkdownEditor
            defaultValue={comment.content}
            editing={editing}
            onEditingChange={setEditing}
            onChange={onChange}
            onExitEditMode={flush}
            size="compact"
          />
        </div>
      </div>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete comment"
        description="Are you sure you want to delete this comment? This action cannot be undone."
        onConfirm={handleDelete}
      />
    </div>
  )
}
