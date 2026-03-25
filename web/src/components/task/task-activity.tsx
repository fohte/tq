import { MarkdownEditor } from '@web/components/ui/markdown-editor'
import type { Comment } from '@web/hooks/use-task-comments'
import {
  useCreateComment,
  useDeleteComment,
  useTaskComments,
  useUpdateComment,
} from '@web/hooks/use-task-comments'
import { cn } from '@web/lib/utils'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
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
  const [isEditing, setIsEditing] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const editContentRef = useRef(comment.content)
  const updateComment = useUpdateComment(taskId)
  const deleteComment = useDeleteComment(taskId)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showMenu) return

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenu])

  const handleSave = useCallback(() => {
    const trimmed = editContentRef.current.trim()
    if (trimmed && trimmed !== comment.content) {
      updateComment.mutate({ commentId: comment.id, content: trimmed })
    }
    setIsEditing(false)
  }, [comment.content, comment.id, updateComment])

  const handleDelete = useCallback(() => {
    deleteComment.mutate(comment.id)
    setShowMenu(false)
  }, [comment.id, deleteComment])

  const timestamp = formatRelativeTime(comment.createdAt)
  const isEdited = comment.createdAt !== comment.updatedAt

  return (
    <div className="flex overflow-hidden rounded-md border border-border bg-card">
      {/* Orange accent bar */}
      <div className="w-[3px] shrink-0 bg-orange-500" />

      <div className="flex min-w-0 flex-1 flex-col gap-1 px-2.5 py-2">
        {/* Timestamp */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {timestamp}
            {isEdited && ' (edited)'}
          </span>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="rounded p-1 text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            >
              <MoreHorizontal className="size-3.5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full z-10 mt-1 min-w-[120px] rounded-md border border-border bg-popover p-1 shadow-md">
                <button
                  type="button"
                  onClick={() => {
                    editContentRef.current = comment.content
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
            <div className="text-sm">
              <MarkdownEditor
                defaultValue={comment.content}
                onChange={(md) => {
                  editContentRef.current = md
                }}
              />
            </div>
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
                className="rounded-md bg-orange-500 px-3 py-1 text-xs text-white hover:bg-orange-600"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div className="text-[13px] leading-relaxed text-foreground">
            <MarkdownEditor defaultValue={comment.content} />
          </div>
        )}
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
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}
