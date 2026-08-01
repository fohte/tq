import { useCallback, useRef, useState } from 'react'

import { LlmAuthorLabel } from '#components/task/llm-author-label'
import { Button } from '#components/ui/button'
import { DeleteConfirmButton } from '#components/ui/delete-confirm-button'
import { MarkdownEditor } from '#components/ui/markdown-editor'
import { SectionHeading } from '#components/ui/section-heading'
import { useDebouncedSave } from '#hooks/use-debounced-save'
import type { Comment } from '#hooks/use-task-comments'
import {
  useCreateComment,
  useDeleteComment,
  useTaskComments,
  useUpdateComment,
} from '#hooks/use-task-comments'
import { formatRelativeTime } from '#lib/format'

// --- Public API ---

export function TaskActivity({ taskId }: { taskId: string }) {
  const { data: comments, isLoading } = useTaskComments(taskId)

  return (
    <div className="flex flex-col gap-3.5">
      <SectionHeading level={3}>activity</SectionHeading>

      {isLoading ? (
        <p className="font-mono text-xs text-muted-foreground">Loading...</p>
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
      <p className="font-mono text-xs text-muted-foreground">
        No comments yet.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {comments.map((comment) => (
        <CommentRow key={comment.id} taskId={taskId} comment={comment} />
      ))}
    </div>
  )
}

// --- Comment Row ---

function CommentRow({ taskId, comment }: { taskId: string; comment: Comment }) {
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

  const timestamp = formatRelativeTime(comment.createdAt)
  const isEdited = comment.createdAt !== comment.updatedAt

  return (
    <div className="grid grid-cols-[14px_1fr] gap-3">
      {/* Only comment-type activity exists today, so a single glyph suffices. */}
      <span className="pt-0.5 font-mono text-[11px] text-muted-foreground-ghost">
        &rsaquo;
      </span>

      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <span>
              {timestamp}
              {isEdited && ' (edited)'}
            </span>
            <LlmAuthorLabel author={comment.author} />
          </div>

          {/* onMouseDownCapture cancels the pending debounced save before
              opening the dialog moves focus off the editor, which would
              otherwise flush (and thus save) it out from under this delete
              flow — even if the user then cancels the dialog. */}
          <div onMouseDownCapture={cancel}>
            <DeleteConfirmButton
              title="Delete comment"
              description="Are you sure you want to delete this comment? This action cannot be undone."
              onDelete={handleDelete}
              iconClassName="size-3"
            />
          </div>
        </div>

        {/* Body - inline editable with debounced auto-save */}
        <div className="border-l-[3px] border-l-primary bg-card p-2.5 text-[13px] leading-[1.7] text-muted-foreground">
          <MarkdownEditor
            defaultValue={comment.content}
            onChange={onChange}
            viewEditToggle={{ onExitEditMode: flush }}
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
    <div className="flex items-start gap-2.5">
      <span className="pt-2.5 font-mono text-xs text-primary">&gt;</span>
      <div className="flex flex-1 flex-col gap-2 border border-border bg-card px-3 py-2.5">
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
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit || createComment.isPending}
          >
            Comment
          </Button>
        </div>
      </div>
    </div>
  )
}
