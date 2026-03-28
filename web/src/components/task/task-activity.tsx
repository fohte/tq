import { DeleteConfirmButton } from '@web/components/ui/delete-confirm-button'
import { MarkdownEditor } from '@web/components/ui/markdown-editor'
import type { Comment } from '@web/hooks/use-task-comments'
import {
  useCreateComment,
  useDeleteComment,
  useTaskComments,
  useUpdateComment,
} from '@web/hooks/use-task-comments'
import { cn } from '@web/lib/utils'
import { useCallback, useEffect, useRef, useState } from 'react'

// --- Public API ---

export function TaskActivity({ taskId }: { taskId: string }) {
  const { data: comments, isLoading } = useTaskComments(taskId)

  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="text-sm font-semibold text-foreground">Activity</h3>

      <CommentInput taskId={taskId} />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <CommentList taskId={taskId} comments={comments ?? []} />
      )}
    </div>
  )
}

// --- Comment List ---

function CommentList({
  taskId,
  comments,
}: {
  taskId: string
  comments: Comment[]
}) {
  if (comments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No comments yet. Add a comment above.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      {comments.map((comment) => (
        <CommentCard key={comment.id} taskId={taskId} comment={comment} />
      ))}
    </div>
  )
}

// --- Comment Card ---

function CommentCard({
  taskId,
  comment,
}: {
  taskId: string
  comment: Comment
}) {
  const updateComment = useUpdateComment(taskId)
  const deleteComment = useDeleteComment(taskId)
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSaveRef = useRef<(() => void) | null>(null)

  const handleChange = useCallback(
    (markdown: string) => {
      if (pendingRef.current) clearTimeout(pendingRef.current)
      const doSave = () => {
        const trimmed = markdown.trim()
        if (trimmed) {
          updateComment.mutate({ commentId: comment.id, content: trimmed })
        }
        pendingSaveRef.current = null
      }
      pendingSaveRef.current = doSave
      pendingRef.current = setTimeout(doSave, 1000)
    },
    [comment.id, updateComment],
  )

  useEffect(() => {
    return () => {
      if (pendingRef.current) clearTimeout(pendingRef.current)
      pendingSaveRef.current?.()
    }
  }, [])

  const handleDelete = useCallback(() => {
    // Cancel any pending save before deleting
    if (pendingRef.current) clearTimeout(pendingRef.current)
    pendingSaveRef.current = null
    deleteComment.mutate(comment.id)
  }, [comment.id, deleteComment])

  const timestamp = formatRelativeTime(comment.createdAt)
  const isEdited = comment.createdAt !== comment.updatedAt

  return (
    <div className="flex rounded-md border border-border bg-card">
      {/* Orange accent bar */}
      <div className="w-[3px] shrink-0 rounded-l-md bg-orange-500" />

      <div className="flex min-w-0 flex-1 flex-col gap-1 px-2.5 py-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {timestamp}
            {isEdited && ' (edited)'}
          </span>

          <DeleteConfirmButton
            title="Delete comment"
            description="Are you sure you want to delete this comment? This action cannot be undone."
            onDelete={handleDelete}
            iconClassName="size-3"
          />
        </div>

        {/* Body - inline editable with debounced auto-save */}
        <div className="text-[13px] leading-relaxed text-foreground">
          <MarkdownEditor
            defaultValue={comment.content}
            onChange={handleChange}
          />
        </div>
      </div>
    </div>
  )
}

// --- Comment Input ---

function CommentInput({ taskId }: { taskId: string }) {
  const contentRef = useRef('')
  const [canSubmit, setCanSubmit] = useState(false)
  const [editorKey, setEditorKey] = useState(0)
  const createComment = useCreateComment(taskId)

  const handleSubmit = useCallback(() => {
    const trimmed = contentRef.current.trim()
    if (!trimmed) return
    createComment.mutate(trimmed)
    contentRef.current = ''
    setCanSubmit(false)
    setEditorKey((k) => k + 1)
  }, [createComment])

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="text-[13px]">
        <MarkdownEditor
          key={editorKey}
          defaultValue=""
          placeholder="Add a comment..."
          onChange={(md) => {
            contentRef.current = md
            setCanSubmit(!!md.trim())
          }}
        />
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || createComment.isPending}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium',
            canSubmit && !createComment.isPending
              ? 'bg-orange-500 text-white hover:bg-orange-600'
              : 'cursor-not-allowed bg-orange-500/50 text-white/50',
          )}
        >
          Comment
        </button>
      </div>
    </div>
  )
}

// --- Helpers ---

function formatRelativeTime(isoString: string): string {
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

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}
