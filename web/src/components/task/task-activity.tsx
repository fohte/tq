import { Button } from '@fohte/ui/button'
import { useCallback, useMemo, useRef, useState } from 'react'

import { ActivityHeader, formatWho } from '#components/task/activity-header'
import { CommentRow } from '#components/task/comment-row'
import { MarkdownEditor } from '#components/ui/markdown-editor'
import { SectionHeading } from '#components/ui/section-heading'
import type { ActivityItem } from '#hooks/use-task-activity'
import { useTaskActivity } from '#hooks/use-task-activity'
import type { Comment } from '#hooks/use-task-comments'
import { useCreateComment, useTaskComments } from '#hooks/use-task-comments'
import { formatRelativeTime } from '#lib/format'

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
