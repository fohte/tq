import { useCallback, useMemo, useRef, useState } from 'react'

import { Button } from '#components/ui/button'
import { DeleteConfirmButton } from '#components/ui/delete-confirm-button'
import { MarkdownEditor } from '#components/ui/markdown-editor'
import { SectionHeading } from '#components/ui/section-heading'
import { useDebouncedSave } from '#hooks/use-debounced-save'
import type { ActivityItem } from '#hooks/use-task-activity'
import { useTaskActivity } from '#hooks/use-task-activity'
import type { Comment } from '#hooks/use-task-comments'
import {
  useCreateComment,
  useDeleteComment,
  useTaskComments,
  useUpdateComment,
} from '#hooks/use-task-comments'
import { formatRelativeTime } from '#lib/format'
import { cn } from '#lib/utils'

type ActivityAuthor = Comment['author']

// tq is a single-user tool, so authors carry a role (human/llm/system) rather
// than a name. Missing data (e.g. comments created before authors were
// tracked) falls back to a neutral placeholder instead of a blank.
function formatWho(author: ActivityAuthor | null): string {
  if (!author) return 'someone'
  if (author.kind === 'human') return 'you'
  if (author.kind === 'system') return 'system'
  return author.agent ?? 'someone'
}

function formatEventWhat(event: ActivityItem): string {
  switch (event.type) {
    case 'created':
      return 'created this task'
    case 'status_changed':
      return `changed status ${event.fromStatus} → ${event.toStatus}`
    case 'github_linked':
      return `linked ${event.owner}/${event.repo}#${String(event.number)}`
    case 'github_unlinked':
      return `unlinked ${event.owner}/${event.repo}#${String(event.number)}`
  }
}

// --- Public API ---

export function TaskActivity({ taskId }: { taskId: string }) {
  const { data: comments, isLoading: commentsLoading } = useTaskComments(taskId)
  const { data: events, isLoading: eventsLoading } = useTaskActivity(taskId)

  return (
    <div className="flex flex-col gap-3.5">
      <SectionHeading level={3}>activity</SectionHeading>

      {commentsLoading || eventsLoading ? (
        <p className="font-mono text-xs text-muted-foreground">Loading...</p>
      ) : (
        <ActivityTimeline
          taskId={taskId}
          comments={comments ?? []}
          events={events ?? []}
        />
      )}

      <CommentInput taskId={taskId} />
    </div>
  )
}

// --- Activity Timeline ---

type ActivityEntry =
  | { key: string; createdAt: string; kind: 'comment'; comment: Comment }
  | { key: string; createdAt: string; kind: 'event'; event: ActivityItem }

function ActivityTimeline({
  taskId,
  comments,
  events,
}: {
  taskId: string
  comments: Comment[]
  events: ActivityItem[]
}) {
  const entries = useMemo(() => {
    const merged: ActivityEntry[] = [
      ...comments.map((comment): ActivityEntry => ({
        key: `comment-${comment.id}`,
        createdAt: comment.createdAt,
        kind: 'comment',
        comment,
      })),
      ...events.map((event): ActivityEntry => ({
        key: `event-${event.id}`,
        createdAt: event.createdAt,
        kind: 'event',
        event,
      })),
    ]
    merged.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return merged
  }, [comments, events])

  if (entries.length === 0) {
    return (
      <p className="font-mono text-xs text-muted-foreground">
        No activity yet.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {entries.map((entry) =>
        entry.kind === 'comment' ? (
          <CommentRow key={entry.key} taskId={taskId} comment={entry.comment} />
        ) : (
          <EventRow key={entry.key} event={entry.event} />
        ),
      )}
    </div>
  )
}

// --- Activity Row Header ---

function ActivityHeader({
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

// --- Event Row ---

function EventRow({ event }: { event: ActivityItem }) {
  return (
    <div className="grid grid-cols-(--icon-content-columns) gap-3">
      <span className="pt-px font-mono text-2xs text-muted-foreground-ghost">
        &middot;
      </span>
      <div className="min-w-0">
        <ActivityHeader
          who={formatWho(event.author)}
          what={formatEventWhat(event)}
          when={formatRelativeTime(event.createdAt)}
        />
      </div>
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
        <div className="border-l-3 border-l-primary bg-card p-2.5 text-sm leading-relaxed text-muted-foreground">
          <MarkdownEditor
            defaultValue={comment.content}
            onChange={onChange}
            viewEditToggle={{ onExitEditMode: flush }}
            size="compact"
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
        <div className="text-sm">
          <MarkdownEditor
            key={editorKey}
            defaultValue=""
            placeholder="Add a comment..."
            onChange={(md) => {
              contentRef.current = md
              setCanSubmit(!!md.trim())
            }}
            size="compact"
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
