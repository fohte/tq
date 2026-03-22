import type { Comment } from '@web/hooks/use-task-comments'
import {
  useCreateComment,
  useDeleteComment,
  useTaskComments,
  useUpdateComment,
} from '@web/hooks/use-task-comments'
import { cn } from '@web/lib/utils'
import { MessageSquare, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

// --- Public API ---

export function TaskActivity({ taskId }: { taskId: string }) {
  const { data: comments, isLoading } = useTaskComments(taskId)

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-foreground">Activity</h3>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <CommentList taskId={taskId} comments={comments ?? []} />
      )}

      <CommentInput taskId={taskId} />
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
        No comments yet. Add a comment below.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
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
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(comment.content)
  const [showMenu, setShowMenu] = useState(false)
  const updateComment = useUpdateComment(taskId)
  const deleteComment = useDeleteComment(taskId)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleSave = useCallback(() => {
    const trimmed = editContent.trim()
    if (trimmed && trimmed !== comment.content) {
      updateComment.mutate({ commentId: comment.id, content: trimmed })
    }
    setIsEditing(false)
  }, [editContent, comment.content, comment.id, updateComment])

  const handleDelete = useCallback(() => {
    deleteComment.mutate(comment.id)
    setShowMenu(false)
  }, [comment.id, deleteComment])

  const timestamp = formatRelativeTime(comment.createdAt)
  const isEdited = comment.createdAt !== comment.updatedAt

  return (
    <div className="flex gap-3">
      {/* Orange accent line */}
      <div className="w-0.5 shrink-0 rounded-full bg-orange-500" />

      <div className="min-w-0 flex-1 rounded-lg border border-border bg-card p-3">
        {/* Header */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {timestamp}
            {isEdited && ' (edited)'}
          </span>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="rounded p-1 text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            >
              <MoreHorizontal className="size-3.5" />
            </button>

            {showMenu && (
              <div
                ref={menuRef}
                className="absolute right-0 top-full z-10 mt-1 min-w-[120px] rounded-md border border-border bg-popover p-1 shadow-md"
              >
                <button
                  type="button"
                  onClick={() => {
                    setEditContent(comment.content)
                    setIsEditing(true)
                    setShowMenu(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-foreground hover:bg-secondary"
                >
                  <Pencil className="size-3" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-3" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        {isEditing ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSave()
                }
                if (e.key === 'Escape') {
                  setIsEditing(false)
                }
              }}
              autoFocus
              rows={3}
              className="w-full resize-none rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-md px-3 py-1 text-xs text-muted-foreground hover:bg-secondary/50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm text-foreground">
            {comment.content}
          </p>
        )}
      </div>
    </div>
  )
}

// --- Comment Input ---

function CommentInput({ taskId }: { taskId: string }) {
  const [content, setContent] = useState('')
  const createComment = useCreateComment(taskId)

  const handleSubmit = useCallback(() => {
    const trimmed = content.trim()
    if (!trimmed) return
    createComment.mutate(trimmed)
    setContent('')
  }, [content, createComment])

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            handleSubmit()
          }
        }}
        placeholder="Add a comment..."
        rows={3}
        className="w-full resize-none rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!content.trim() || createComment.isPending}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium',
            content.trim()
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'cursor-not-allowed bg-primary/50 text-primary-foreground/50',
          )}
        >
          <MessageSquare className="size-3" />
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
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}
